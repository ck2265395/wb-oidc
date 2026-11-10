import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { getPool } from '../db/pool';
import { loadConfig } from '../config/env';
import { DeveloperPrincipal, DeveloperRow } from './developer.types';

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
  /** 注册即普通用户，无需审核，不采集开发者资料 */
  async register(email: string, password: string, ip?: string): Promise<void> {
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
      `INSERT INTO oidc_developer (email, password_hash, status, developer_status)
       VALUES ($1,$2,'active','none')`,
      [mail, hash],
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
    if (row.status === 'suspended') {
      throw new ForbiddenException(`账号已被停用${row.reject_reason ? `：${row.reject_reason}` : ''}`);
    }

    await getPool().query('UPDATE oidc_developer SET last_login_at = NOW() WHERE id = $1', [
      row.id,
    ]);
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
    const { rows } = await getPool().query<DeveloperRow>(
      'SELECT password_hash FROM oidc_developer WHERE id = $1 LIMIT 1',
      [developerId],
    );
    const hash = rows[0]?.password_hash ?? DUMMY_HASH;
    return bcrypt.compareSync(password || '', hash);
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
        developer_status?: DeveloperRow['developer_status'];
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

  async me(id: number) {
    const { rows } = await getPool().query('SELECT * FROM oidc_developer WHERE id = $1 LIMIT 1', [id]);
    const row = rows[0] as DeveloperRow | undefined;
    if (!row) throw new UnauthorizedException('用户不存在');
    return row;
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
  ): Promise<DeveloperRow> {
    const org = (company || '').trim();
    const phone = (contact || '').trim();
    if (org.length < 2) throw new BadRequestException('请填写公司 / 团队名称（至少 2 个字符）');
    if (phone.length < 2) throw new BadRequestException('请填写联系方式');
    if (org.length > 128 || phone.length > 64) {
      throw new BadRequestException('资料长度超出限制');
    }
    const devType = developerType === 'enterprise' ? 'enterprise' : 'personal';
    const pool = getPool();
    const { rows } = await pool.query<DeveloperRow>(
      `UPDATE oidc_developer
          SET company = $2, contact = $3, developer_type = $4,
              developer_status = 'pending', developer_reject_reason = '',
              developer_applied_at = NOW(), updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
          AND developer_status IN ('none','rejected')
        RETURNING *`,
      [id, org, phone, devType],
    );
    if (!rows.length) {
      const current = await this.me(id);
      if (current.developer_status === 'pending') {
        throw new BadRequestException('申请正在审核中，请耐心等待');
      }
      if (current.developer_status === 'approved') {
        throw new BadRequestException('你已通过开发者审核，无需重复申请');
      }
      throw new ForbiddenException('账号当前不可申请开发者资格');
    }
    return rows[0];
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
  ): Promise<DeveloperRow> {
    const org = (company || '').trim();
    const phone = (contact || '').trim();
    if (org.length < 2) throw new BadRequestException('请填写公司 / 团队名称（至少 2 个字符）');
    if (phone.length < 2) throw new BadRequestException('请填写联系方式');
    if (org.length > 128 || phone.length > 64) {
      throw new BadRequestException('资料长度超出限制');
    }
    const devType = developerType === 'enterprise' ? 'enterprise' : 'personal';
    const { rows } = await getPool().query<DeveloperRow>(
      `UPDATE oidc_developer
          SET company = $2, contact = $3, developer_type = $4, updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
        RETURNING *`,
      [id, org, phone, devType],
    );
    if (!rows.length) throw new ForbiddenException('账号已被停用，无法修改资料');
    return rows[0];
  }

  /**
   * 创建/修改应用前的实时资格校验。
   * 必须查库而不能只信 JWT：管理员审核通过后，用户手上的旧 token 仍是旧状态。
   */
  async assertDeveloperApproved(id: number): Promise<void> {
    const row = await this.me(id);
    if (row.status !== 'active') {
      throw new ForbiddenException('账号已被停用，无法管理应用');
    }
    if (row.developer_status === 'none') {
      throw new ForbiddenException('请先申请成为开发者，审核通过后才能创建应用');
    }
    if (row.developer_status === 'pending') {
      throw new ForbiddenException('开发者资格正在审核中，审核通过后才能创建应用');
    }
    if (row.developer_status === 'rejected') {
      throw new ForbiddenException(
        `开发者资格申请未通过${row.developer_reject_reason ? `：${row.developer_reject_reason}` : ''}，请补齐资料后重新提交`,
      );
    }
  }

  /** 吊销某用户全部会话（账号状态变化时调用） */
  async revokeAllSessions(developerId: number): Promise<void> {
    await getPool().query(
      'UPDATE oidc_developer_session SET revoked_at = NOW() WHERE developer_id = $1 AND revoked_at IS NULL',
      [developerId],
    );
  }

  private get cfg() {
    return loadConfig().adminAuth; // 与管理员共用 JWT 密钥，typ 字段区分
  }

  private principal(row: DeveloperRow): DeveloperPrincipal {
    return {
      id: row.id,
      email: row.email,
      status: row.status,
      developer_status: row.developer_status,
      developer_type: row.developer_type ?? undefined,
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
