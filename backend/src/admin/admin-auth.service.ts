import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { DataSource, IsNull } from 'typeorm';
import { loadConfig } from '../config/env';
import { OidcAdmin, OidcAdminSession } from '../db/entities';
import { AdminAuditService } from './admin-audit.service';
import { assertPasswordStrength } from './admin-password.util';
import { AdminPrincipal, AdminRole, toAdminView, AdminView } from './admin.types';

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  admin: AdminView;
  refreshToken: string;
  refreshTtlSeconds: number;
}

export interface RefreshResult {
  accessToken: string;
  expiresIn: number;
  admin: AdminView;
  refreshToken: string;
  refreshTtlSeconds: number;
}

/**
 * 管理端认证：
 * - 密码 bcrypt 校验（独立 admin 表，不依赖老系统）
 * - access token：短时效 JWT，前端只在内存持有
 * - refresh token：随机串，服务端只存 SHA-256 哈希，刷新即轮换、可单独吊销
 */
@Injectable()
export class AdminAuthService {
  /** 账号不存在时用于等时比对的占位哈希（启动时生成一次，避免长度非法抛错） */
  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', 10);

  constructor(
    @Inject(DataSource) private readonly ds: DataSource,
    private readonly audit: AdminAuditService,
  ) {}

  private get adminRepo() {
    return this.ds.getRepository(OidcAdmin);
  }

  private get sessionRepo() {
    return this.ds.getRepository(OidcAdminSession);
  }

  private get cfg() {
    return loadConfig().adminAuth;
  }

  async login(
    username: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    if (!username || !password) {
      throw new UnauthorizedException('用户名和密码不能为空');
    }
    const row = await this.adminRepo.findOne({ where: { username } });
    // 用户不存在也走一次 bcrypt 比对，避免时序差异暴露账号是否存在
    const hash = row?.passwordHash ?? this.dummyHash;
    const ok = bcrypt.compareSync(password, hash);
    if (!row || !ok) {
      await this.audit.log(null, 'admin.login.failed', username, { reason: 'bad_credentials' }, ip);
      throw new UnauthorizedException('用户名或密码不正确');
    }
    if (!row.enabled) {
      await this.audit.log(
        { id: Number(row.id), username: row.username, displayName: row.displayName, role: row.role },
        'admin.login.failed',
        row.username,
        { reason: 'disabled' },
        ip,
      );
      throw new UnauthorizedException('该管理员账号已被停用');
    }

    await this.adminRepo.update({ id: row.id }, { lastLoginAt: new Date() });

    const admin: AdminPrincipal = {
      id: Number(row.id),
      username: row.username,
      displayName: row.displayName,
      role: row.role,
    };
    const accessToken = this.signAccess(admin);
    const refreshToken = await this.createSession(row.id, ip, userAgent);
    await this.audit.log(admin, 'admin.login', row.username, undefined, ip);

    return {
      accessToken,
      expiresIn: this.cfg.accessTtlSeconds,
      admin: toAdminView(row),
      refreshToken,
      refreshTtlSeconds: this.cfg.refreshTtlDays * 86400,
    };
  }

  /** 刷新：校验哈希 + 有效期 + 未吊销，轮换新令牌 */
  async refresh(rawToken: string, ip?: string, userAgent?: string): Promise<RefreshResult> {
    if (!rawToken) throw new UnauthorizedException('缺少刷新令牌');
    const hash = this.hashToken(rawToken);
    const session = await this.sessionRepo.findOne({
      where: { tokenHash: hash },
      relations: { admin: true },
    });
    const row = session?.admin;
    if (
      !session ||
      !row ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (!row.enabled) {
      throw new UnauthorizedException('该管理员账号已被停用');
    }

    const admin: AdminPrincipal = {
      id: Number(row.id),
      username: row.username,
      displayName: row.displayName,
      role: row.role,
    };
    // 轮换：旧令牌立即作废，签发新的
    await this.sessionRepo.update({ id: session.id }, { revokedAt: new Date() });
    const newRefresh = await this.createSession(row.id, ip, userAgent);
    await this.audit.log(admin, 'admin.token.refresh', row.username, undefined, ip);

    return {
      accessToken: this.signAccess(admin),
      expiresIn: this.cfg.accessTtlSeconds,
      admin: toAdminView(row),
      refreshToken: newRefresh,
      refreshTtlSeconds: this.cfg.refreshTtlDays * 86400,
    };
  }

  async logout(rawToken?: string, admin?: AdminPrincipal, ip?: string): Promise<void> {
    if (rawToken) {
      await this.sessionRepo.update(
        { tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
    await this.audit.log(admin ?? null, 'admin.logout', admin?.username, undefined, ip);
  }

  /**
   * 自助修改密码：必须提供原密码。
   * 成功后吊销该账号全部刷新令牌（含当前设备的），强制重新登录。
   */
  async changePassword(
    admin: AdminPrincipal,
    oldPassword: string,
    newPassword: string,
    ip?: string,
  ): Promise<void> {
    const row = await this.adminRepo.findOne({ where: { id: admin.id } });
    if (!row) throw new UnauthorizedException('管理员不存在');

    if (!bcrypt.compareSync(oldPassword || '', row.passwordHash)) {
      await this.audit.log(
        admin,
        'admin.password.change_failed',
        admin.username,
        { reason: 'bad_old_password' },
        ip,
      );
      throw new BadRequestException('原密码不正确');
    }

    assertPasswordStrength(newPassword, row.username);
    if (bcrypt.compareSync(newPassword, row.passwordHash)) {
      throw new BadRequestException('新密码不能与原密码相同');
    }

    const hash = await bcrypt.hash(newPassword, 10);
    // 改密 + 吊销全部会话必须原子完成，避免窗口期内旧会话仍可用
    await this.ds.transaction(async (em) => {
      await em.getRepository(OidcAdmin).update({ id: row.id }, { passwordHash: hash });
      await em.getRepository(OidcAdminSession).update(
        { adminId: row.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    });
    await this.audit.log(admin, 'admin.password.change', admin.username, undefined, ip);
  }

  verifyAccess(token: string): AdminPrincipal {
    try {
      const payload = jwt.verify(token, this.cfg.jwtSecret, { algorithms: ['HS256'] }) as {
        sub: string;
        username: string;
        display_name?: string;
        role?: AdminRole;
        typ?: string;
      };
      if (payload.typ !== 'admin_access') throw new Error('wrong token type');
      return {
        id: Number(payload.sub),
        username: payload.username,
        displayName: payload.display_name || payload.username,
        role: (payload.role as AdminRole) || 'operator',
      };
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  async me(adminId: number): Promise<AdminView> {
    const row = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!row) throw new UnauthorizedException('管理员不存在');
    return toAdminView(row);
  }

  private signAccess(admin: AdminPrincipal): string {
    return jwt.sign(
      {
        sub: String(admin.id),
        username: admin.username,
        display_name: admin.displayName,
        role: admin.role,
        typ: 'admin_access',
      },
      this.cfg.jwtSecret,
      { algorithm: 'HS256', expiresIn: this.cfg.accessTtlSeconds },
    );
  }

  private async createSession(
    adminId: number,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.cfg.refreshTtlDays * 86400_000);
    await this.sessionRepo.insert({
      adminId,
      tokenHash: this.hashToken(raw),
      expiresAt,
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    return raw;
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
