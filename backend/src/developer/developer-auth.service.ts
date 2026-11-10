import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { DataSource, In, IsNull } from 'typeorm';
import { loadConfig } from '../config/env';
import { OidcDeveloper, OidcDeveloperSession } from '../db/entities';
import { DeveloperPrincipal, DeveloperView, toDeveloperView } from './developer.types';

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

/**
 * 门户账号认证 + 开发者资格。
 *
 * 流程：注册 → 立即 active 可登录（普通用户，developer_status=none）
 *      → 需要创建应用时补齐资料申请开发者资格（pending）
 *      → 管理员审核通过（approved）才能创建应用。
 *
 * 与管理员共用 JWT 密钥但 typ 不同（developer_access），Guard 严格区分；
 * refresh 采用与管理员相同的 httpOnly cookie 轮换机制。
 */
@Injectable()
export class DeveloperAuthService {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  private get repo() {
    return this.ds.getRepository(OidcDeveloper);
  }

  private get sessionRepo() {
    return this.ds.getRepository(OidcDeveloperSession);
  }

  /** 注册即普通用户，无需审核，不采集开发者资料 */
  async register(email: string, password: string, ip?: string): Promise<void> {
    const mail = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      throw new BadRequestException('邮箱格式不正确');
    }
    this.assertPassword(password);
    const hash = await bcrypt.hash(password, 10);
    try {
      await this.repo.insert({
        email: mail,
        passwordHash: hash,
        status: 'active',
        developerStatus: 'none',
      });
    } catch (err) {
      const e = err as { code?: string; driverError?: { code?: string } };
      if (e?.code === '23505' || e?.driverError?.code === '23505') {
        throw new ConflictException('该邮箱已注册');
      }
      throw err;
    }
    void ip;
  }

  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; expiresIn: number; developer: DeveloperPrincipal; refreshToken: string; refreshTtlSeconds: number }> {
    const mail = (email || '').trim().toLowerCase();
    const row = await this.repo.findOne({ where: { email: mail } });
    const hash = row?.passwordHash ?? DUMMY_HASH;
    const ok = bcrypt.compareSync(password || '', hash);
    if (!row || !ok) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    if (row.status === 'suspended') {
      throw new ForbiddenException(`账号已被停用${row.rejectReason ? `：${row.rejectReason}` : ''}`);
    }

    await this.repo.update({ id: row.id }, { lastLoginAt: new Date() });
    const principal = this.principal(row);
    const accessToken = this.signAccess(principal);
    const refreshToken = await this.createSession(row.id, ip, userAgent);
    return {
      accessToken,
      expiresIn: this.cfg.accessTtlSeconds,
      developer: principal,
      refreshToken,
      refreshTtlSeconds: this.cfg.refreshTtlDays * 86400,
    };
  }

  /** 二次验证：查看 client_secret 前要求重新输入登录密码。 */
  async verifyPassword(developerId: number, password: string): Promise<boolean> {
    const row = await this.repo.findOne({
      where: { id: developerId },
      select: { id: true, passwordHash: true },
    });
    const hash = row?.passwordHash ?? DUMMY_HASH;
    return bcrypt.compareSync(password || '', hash);
  }

  async refresh(rawToken: string, ip?: string, userAgent?: string) {
    if (!rawToken) throw new UnauthorizedException('缺少刷新令牌');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = await this.sessionRepo.findOne({
      where: { tokenHash: hash },
      relations: { developer: true },
    });
    const row = session?.developer;
    if (!session || !row || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (row.status !== 'active') {
      throw new ForbiddenException('账号当前不可用，请重新登录');
    }
    await this.sessionRepo.update({ id: session.id }, { revokedAt: new Date() });
    const principal = this.principal(row);
    const refreshToken = await this.createSession(row.id, ip, userAgent);
    return {
      accessToken: this.signAccess(principal),
      expiresIn: this.cfg.accessTtlSeconds,
      developer: principal,
      refreshToken,
      refreshTtlSeconds: this.cfg.refreshTtlDays * 86400,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await this.sessionRepo.update(
        { tokenHash: hash, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }
  }

  verifyAccess(token: string): DeveloperPrincipal {
    try {
      const payload = jwt.verify(token, this.cfg.jwtSecret, { algorithms: ['HS256'] }) as {
        sub: string;
        email: string;
        status: OidcDeveloper['status'];
        developer_status?: OidcDeveloper['developerStatus'];
        developer_type?: 'personal' | 'enterprise';
        typ?: string;
      };
      if (payload.typ !== 'developer_access') throw new Error('wrong token type');
      return {
        id: Number(payload.sub),
        email: payload.email,
        status: payload.status,
        // 兼容升级前签发的旧 token
        developer_status: payload.developer_status || 'none',
        developer_type: payload.developer_type,
      };
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  async me(id: number): Promise<DeveloperView> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new UnauthorizedException('用户不存在');
    return toDeveloperView(row);
  }

  /**
   * 申请成为开发者：补齐资料后进入待审核。
   * 仅普通用户（none）或被驳回（rejected）可提交；pending 不可重复提交，approved 已无需申请。
   */
  async applyDeveloper(
    id: number,
    company: string,
    contact: string,
    developerType?: 'personal' | 'enterprise',
  ): Promise<DeveloperView> {
    const { org, phone, devType } = this.validateProfile(company, contact, developerType);
    const result = await this.repo.update(
      {
        id,
        status: 'active',
        developerStatus: In(['none', 'rejected']),
      },
      {
        company: org,
        contact: phone,
        developerType: devType,
        developerStatus: 'pending',
        developerRejectReason: '',
        developerAppliedAt: new Date(),
      },
    );
    if (!result.affected) {
      const current = await this.me(id);
      if (current.developer_status === 'pending') {
        throw new BadRequestException('申请正在审核中，请耐心等待');
      }
      if (current.developer_status === 'approved') {
        throw new BadRequestException('你已通过开发者审核，无需重复申请');
      }
      throw new ForbiddenException('账号当前不可申请开发者资格');
    }
    return this.me(id);
  }

  /**
   * 编辑开发者资料：只更新公司与联系方式，不改变开发者资格状态。
   * 任何正常登录的用户都可以维护自己的资料；审核中 / 已认证用户改资料
   * 不会因此被重新拉回审核（资格审核只由 applyDeveloper 或管理员触发）。
   */
  async updateProfile(
    id: number,
    company: string,
    contact: string,
    developerType?: 'personal' | 'enterprise',
  ): Promise<DeveloperView> {
    const { org, phone, devType } = this.validateProfile(company, contact, developerType);
    const result = await this.repo.update(
      { id, status: 'active' },
      { company: org, contact: phone, developerType: devType },
    );
    if (!result.affected) throw new ForbiddenException('账号已被停用，无法修改资料');
    return this.me(id);
  }

  /**
   * 创建/修改应用前的实时资格校验。
   * 必须查库而不能只信 JWT：管理员审核通过后，用户手上的旧 token 仍是旧状态。
   */
  async assertDeveloperApproved(id: number): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new UnauthorizedException('用户不存在');
    if (row.status !== 'active') {
      throw new ForbiddenException('账号已被停用，无法管理应用');
    }
    if (row.developerStatus === 'none') {
      throw new ForbiddenException('请先申请成为开发者，审核通过后才能创建应用');
    }
    if (row.developerStatus === 'pending') {
      throw new ForbiddenException('开发者资格正在审核中，审核通过后才能创建应用');
    }
    if (row.developerStatus === 'rejected') {
      throw new ForbiddenException(
        `开发者资格申请未通过${row.developerRejectReason ? `：${row.developerRejectReason}` : ''}，请补齐资料后重新提交`,
      );
    }
  }

  /** 吊销某用户全部会话（账号状态变化时调用） */
  async revokeAllSessions(developerId: number): Promise<void> {
    await this.sessionRepo.update(
      { developerId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private validateProfile(
    company: string,
    contact: string,
    developerType?: 'personal' | 'enterprise',
  ): { org: string; phone: string; devType: 'personal' | 'enterprise' } {
    const org = (company || '').trim();
    const phone = (contact || '').trim();
    if (org.length < 2) throw new BadRequestException('请填写公司 / 团队名称（至少 2 个字符）');
    if (phone.length < 2) throw new BadRequestException('请填写联系方式');
    if (org.length > 128 || phone.length > 64) {
      throw new BadRequestException('资料长度超出限制');
    }
    return { org, phone, devType: developerType === 'enterprise' ? 'enterprise' : 'personal' };
  }

  private get cfg() {
    return loadConfig().adminAuth; // 与管理员共用 JWT 密钥，typ 字段区分
  }

  private principal(row: OidcDeveloper): DeveloperPrincipal {
    return {
      id: Number(row.id),
      email: row.email,
      status: row.status,
      developer_status: row.developerStatus,
      developer_type: row.developerType ?? undefined,
    };
  }

  private signAccess(principal: DeveloperPrincipal): string {
    return jwt.sign(
      {
        sub: String(principal.id),
        email: principal.email,
        status: principal.status,
        developer_status: principal.developer_status,
        developer_type: principal.developer_type,
        typ: 'developer_access',
      },
      this.cfg.jwtSecret,
      { algorithm: 'HS256', expiresIn: this.cfg.accessTtlSeconds },
    );
  }

  private async createSession(developerId: number, ip?: string, userAgent?: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.cfg.refreshTtlDays * 86400_000);
    await this.sessionRepo.insert({
      developerId,
      tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
      expiresAt,
      ip: ip ?? null,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    return raw;
  }

  private assertPassword(password: string): void {
    const pwd = password || '';
    if (pwd.length < 10) throw new BadRequestException('密码至少 10 位');
    if (pwd.length > 128) throw new BadRequestException('密码不能超过 128 位');
    if (!/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) {
      throw new BadRequestException('密码需同时包含字母和数字');
    }
  }
}
