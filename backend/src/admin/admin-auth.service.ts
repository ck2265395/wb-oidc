import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { getPool } from '../db/pool';
import { loadConfig } from '../config/env';
import { AdminAuditService } from './admin-audit.service';
import { AdminPrincipal, AdminRow, AdminRole, toAdminView, AdminView } from './admin.types';

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

  constructor(private readonly audit: AdminAuditService) {}

  private get cfg() {
    return loadConfig().adminAuth;
  }

  private get pool() {
    return getPool();
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
    const { rows } = await this.pool.query<AdminRow>(
      'SELECT * FROM oidc_admin WHERE username = $1 LIMIT 1',
      [username],
    );
    const row = rows[0];
    // 用户不存在也走一次 bcrypt 比对，避免时序差异暴露账号是否存在
    const hash = row?.password_hash ?? this.dummyHash;
    const ok = bcrypt.compareSync(password, hash);
    if (!row || !ok) {
      await this.audit.log(null, 'admin.login.failed', username, { reason: 'bad_credentials' }, ip);
      throw new UnauthorizedException('用户名或密码不正确');
    }
    if (!row.enabled) {
      await this.audit.log(
        { id: row.id, username: row.username, displayName: row.display_name, role: row.role },
        'admin.login.failed',
        row.username,
        { reason: 'disabled' },
        ip,
      );
      throw new UnauthorizedException('该管理员账号已被停用');
    }

    await this.pool.query('UPDATE oidc_admin SET last_login_at = NOW() WHERE id = $1', [row.id]);

    const admin: AdminPrincipal = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
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
    const { rows } = await this.pool.query<
      AdminRow & { session_id: number; expires_at: Date; revoked_at: Date | null }
    >(
      `SELECT a.*, s.id AS session_id, s.expires_at, s.revoked_at
         FROM oidc_admin_session s
         JOIN oidc_admin a ON a.id = s.admin_id
        WHERE s.token_hash = $1 LIMIT 1`,
      [hash],
    );
    const row = rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (!row.enabled) {
      throw new UnauthorizedException('该管理员账号已被停用');
    }

    const admin: AdminPrincipal = {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    };
    // 轮换：旧令牌立即作废，签发新的
    await this.pool.query('UPDATE oidc_admin_session SET revoked_at = NOW() WHERE id = $1', [
      row.session_id,
    ]);
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
      await this.pool.query(
        'UPDATE oidc_admin_session SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
        [this.hashToken(rawToken)],
      );
    }
    await this.audit.log(admin ?? null, 'admin.logout', admin?.username, undefined, ip);
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
    const { rows } = await this.pool.query<AdminRow>(
      'SELECT * FROM oidc_admin WHERE id = $1 LIMIT 1',
      [adminId],
    );
    if (!rows[0]) throw new UnauthorizedException('管理员不存在');
    return toAdminView(rows[0]);
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
    await this.pool.query(
      `INSERT INTO oidc_admin_session (admin_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5)`,
      [adminId, this.hashToken(raw), expiresAt, ip ?? null, userAgent?.slice(0, 300) ?? null],
    );
    return raw;
  }

  private hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
