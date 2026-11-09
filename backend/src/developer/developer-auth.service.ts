import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { getPool } from '../db/pool';
import { loadConfig } from '../config/env';
import { DeveloperPrincipal, DeveloperRow } from './developer.types';

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

/**
 * 开发者（门户第三方）认证。
 * 与管理员共用 JWT 密钥但 typ 不同（developer_access），Guard 严格区分；
 * refresh 采用与管理员相同的 httpOnly cookie 轮换机制。
 */
@Injectable()
export class DeveloperAuthService {
  async register(
    email: string,
    password: string,
    company: string,
    contact: string,
    ip?: string,
  ): Promise<void> {
    const mail = (email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      throw new BadRequestException('邮箱格式不正确');
    }
    this.assertPassword(password);
    const pool = getPool();
    const exists = await pool.query('SELECT 1 FROM oidc_developer WHERE email = $1', [mail]);
    if (exists.rowCount) {
      throw new ConflictException('该邮箱已注册');
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO oidc_developer (email, password_hash, company, contact)
       VALUES ($1,$2,$3,$4)`,
      [mail, hash, (company || '').slice(0, 128), (contact || '').slice(0, 64)],
    );
    void ip;
  }

  async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; expiresIn: number; developer: DeveloperPrincipal; refreshToken: string; refreshTtlSeconds: number }> {
    const mail = (email || '').trim().toLowerCase();
    const { rows } = await getPool().query<DeveloperRow>(
      'SELECT * FROM oidc_developer WHERE email = $1 LIMIT 1',
      [mail],
    );
    const row = rows[0];
    const hash = row?.password_hash ?? DUMMY_HASH;
    const ok = bcrypt.compareSync(password || '', hash);
    if (!row || !ok) {
      throw new UnauthorizedException('邮箱或密码不正确');
    }
    if (row.status === 'pending') {
      throw new ForbiddenException('账号正在等待管理员审核，审核通过后即可登录');
    }
    if (row.status === 'suspended') {
      throw new ForbiddenException(`账号已被停用${row.reject_reason ? `：${row.reject_reason}` : ''}`);
    }

    await getPool().query('UPDATE oidc_developer SET last_login_at = NOW() WHERE id = $1', [
      row.id,
    ]);
    const principal: DeveloperPrincipal = { id: row.id, email: row.email, status: row.status };
    const cfg = this.cfg;
    const accessToken = jwt.sign(
      { sub: String(row.id), email: row.email, status: row.status, typ: 'developer_access' },
      cfg.jwtSecret,
      { algorithm: 'HS256', expiresIn: cfg.accessTtlSeconds },
    );
    const refreshToken = await this.createSession(row.id, ip, userAgent);
    return {
      accessToken,
      expiresIn: cfg.accessTtlSeconds,
      developer: principal,
      refreshToken,
      refreshTtlSeconds: cfg.refreshTtlDays * 86400,
    };
  }

  async refresh(rawToken: string, ip?: string, userAgent?: string) {
    if (!rawToken) throw new UnauthorizedException('缺少刷新令牌');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const { rows } = await getPool().query<DeveloperRow & { session_id: number; expires_at: Date; revoked_at: Date | null }>(
      `SELECT d.*, s.id AS session_id, s.expires_at, s.revoked_at
         FROM oidc_developer_session s
         JOIN oidc_developer d ON d.id = s.developer_id
        WHERE s.token_hash = $1 LIMIT 1`,
      [hash],
    );
    const row = rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new UnauthorizedException('刷新令牌无效或已过期，请重新登录');
    }
    if (row.status !== 'active') {
      throw new ForbiddenException('账号当前不可用，请重新登录');
    }
    await getPool().query('UPDATE oidc_developer_session SET revoked_at = NOW() WHERE id = $1', [
      row.session_id,
    ]);
    const cfg = this.cfg;
    const principal: DeveloperPrincipal = { id: row.id, email: row.email, status: row.status };
    const accessToken = jwt.sign(
      { sub: String(row.id), email: row.email, status: row.status, typ: 'developer_access' },
      cfg.jwtSecret,
      { algorithm: 'HS256', expiresIn: cfg.accessTtlSeconds },
    );
    const refreshToken = await this.createSession(row.id, ip, userAgent);
    return {
      accessToken,
      expiresIn: cfg.accessTtlSeconds,
      developer: principal,
      refreshToken,
      refreshTtlSeconds: cfg.refreshTtlDays * 86400,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await getPool().query(
        'UPDATE oidc_developer_session SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
        [hash],
      );
    }
  }

  verifyAccess(token: string): DeveloperPrincipal {
    try {
      const payload = jwt.verify(token, this.cfg.jwtSecret, { algorithms: ['HS256'] }) as {
        sub: string;
        email: string;
        status: DeveloperRow['status'];
        typ?: string;
      };
      if (payload.typ !== 'developer_access') throw new Error('wrong token type');
      return { id: Number(payload.sub), email: payload.email, status: payload.status };
    } catch {
      throw new UnauthorizedException('登录已失效，请重新登录');
    }
  }

  async me(id: number) {
    const { rows } = await getPool().query('SELECT * FROM oidc_developer WHERE id = $1 LIMIT 1', [id]);
    const row = rows[0] as DeveloperRow | undefined;
    if (!row) throw new UnauthorizedException('开发者不存在');
    return row;
  }

  /** 吊销某开发者全部会话（审核状态变化时调用） */
  async revokeAllSessions(developerId: number): Promise<void> {
    await getPool().query(
      'UPDATE oidc_developer_session SET revoked_at = NOW() WHERE developer_id = $1 AND revoked_at IS NULL',
      [developerId],
    );
  }

  private get cfg() {
    return loadConfig().adminAuth; // 与管理员共用 JWT 密钥，typ 字段区分
  }

  private async createSession(developerId: number, ip?: string, userAgent?: string): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.cfg.refreshTtlDays * 86400_000);
    await getPool().query(
      `INSERT INTO oidc_developer_session (developer_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5)`,
      [developerId, crypto.createHash('sha256').update(raw).digest('hex'), expiresAt, ip ?? null, userAgent?.slice(0, 300) ?? null],
    );
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
