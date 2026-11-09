import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as bcryptjs from 'bcryptjs';
import { LegacyConfig } from '../../config/env';

export interface LegacyUser {
  id: string;
  raw: Record<string, any>;
}

export interface AccountClaims {
  sub: string;
  nickname?: string | null;
  name?: string | null;
  picture?: string | null;
  email?: string | null;
  email_verified?: boolean;
  phone_number?: string | null;
}

/**
 * 直连老系统 PostgreSQL（只读）：校验存量用户账号密码并取回基础资料。
 * 表名/字段名/哈希算法全部可由环境变量配置，不修改老库任何数据。
 * 标识符（表名/字段名）用双引号包裹以支持大小写混合命名；值一律走参数化查询防注入。
 */
@Injectable()
export class LegacyUserService implements OnModuleDestroy {
  private pool?: Pool;
  private cfg?: LegacyConfig;

  private get config(): LegacyConfig {
    if (!this.cfg) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { loadConfig } = require('../../config/env');
      this.cfg = loadConfig().legacy as LegacyConfig;
    }
    return this.cfg as LegacyConfig;
  }

  private get db(): Pool {
    if (!this.pool) {
      const c = this.config;
      this.pool = new Pool({
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
        database: c.database,
        max: 5,
        idleTimeoutMillis: 30000,
      });
      this.pool.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[legacy-db] pool error:', err.message);
      });
    }
    return this.pool;
  }

  /** 校验账号密码，成功返回用户；失败返回 null */
  async verifyLogin(username: string, password: string): Promise<LegacyUser | null> {
    const c = this.config;
    if (!username || !password) return null;
    const sql = `SELECT * FROM "${c.userTable}" WHERE "${c.usernameField}" = $1 LIMIT 1`;
    const { rows } = await this.db.query(sql, [username]);
    if (!rows || rows.length === 0) return null;
    const row = rows[0] as Record<string, any>;
    // 账号状态过滤（如老库 status=1 为正常，0 为禁用/注销）
    if (c.statusField && row[c.statusField] !== undefined && row[c.statusField] !== null) {
      if (String(row[c.statusField]) !== String(c.statusActive)) return null;
    }
    const stored = row[c.passwordField];
    if (typeof stored !== 'string' || !stored) return null;
    const ok = this.verifyPassword(password, stored, row);
    if (!ok) return null;
    const id = row[c.idField];
    if (id === undefined || id === null) return null;
    return { id: String(id), raw: row };
  }

  /** 按 accountId 取 OIDC claims */
  async getClaims(accountId: string): Promise<AccountClaims | null> {
    const c = this.config;
    const sql = `SELECT * FROM "${c.userTable}" WHERE "${c.idField}"::text = $1 LIMIT 1`;
    const { rows } = await this.db.query(sql, [accountId]);
    if (!rows || rows.length === 0) return null;
    const row = rows[0] as Record<string, any>;
    return {
      sub: String(row[c.idField]),
      nickname: row[c.nicknameField] ?? null,
      name: row[c.nicknameField] ?? null,
      picture: row[c.avatarField] ?? null,
      email: row[c.emailField] ?? null,
      email_verified: false,
      phone_number: row[c.phoneField] ?? null,
    };
  }

  private verifyPassword(password: string, stored: string, row: Record<string, any>): boolean {
    const c = this.config;
    // 动态盐（来自用户行的盐字段）或静态盐
    let salt = '';
    if (c.saltField && row[c.saltField]) salt = String(row[c.saltField]);
    else if (c.staticSalt) salt = c.staticSalt;

    const withSalt = (plain: string) => (c.saltPosition === 'suffix' ? plain + salt : salt + plain);

    switch (c.passwordHash) {
      case 'bcrypt':
        return bcryptjs.compareSync(password, stored);
      case 'md5':
        return this.safeEqual(
          crypto.createHash('md5').update(withSalt(password)).digest('hex'),
          stored.toLowerCase(),
        );
      case 'sha1':
        return this.safeEqual(
          crypto.createHash('sha1').update(withSalt(password)).digest('hex'),
          stored.toLowerCase(),
        );
      case 'sha256':
        return this.safeEqual(
          crypto.createHash('sha256').update(withSalt(password)).digest('hex'),
          stored.toLowerCase(),
        );
      // 老系统常见：SHA-256 摘要再 base64（44 位，末尾可能带 =）
      case 'sha256-b64':
        return this.safeEqual(
          crypto.createHash('sha256').update(withSalt(password)).digest('base64'),
          stored,
        );
      // 老系统（moondrop）常见：HMAC-SHA256 + 固定密钥，base64 输出
      case 'hmac-sha256-b64': {
        if (!c.hmacKey) return false;
        return this.safeEqual(
          crypto.createHmac('sha256', c.hmacKey).update(password).digest('base64'),
          stored,
        );
      }
      case 'plain':
        return password === stored;
      default:
        return false;
    }
  }

  /** 定长比较，避免哈希比对的时序侧信道 */
  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }
}
