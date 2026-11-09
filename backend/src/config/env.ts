/**
 * 集中配置：全部来自环境变量，启动时校验，缺失/非法直接 fail-fast。
 */
export interface LegacyConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  userTable: string;
  idField: string;
  usernameField: string;
  passwordField: string;
  passwordHash:
    | 'bcrypt'
    | 'md5'
    | 'sha1'
    | 'sha256'
    | 'sha256-b64'
    | 'hmac-sha256-b64'
    | 'plain';
  /** hmac-sha256-b64 使用的密钥（老系统常见：moondropapp&&） */
  hmacKey: string;
  saltField: string;
  staticSalt: string;
  saltPosition: 'prefix' | 'suffix';
  /** 账号状态过滤：字段名与允许值，留空则不校验（老库常见 status=1 为正常） */
  statusField: string;
  statusActive: string;
  nicknameField: string;
  emailField: string;
  phoneField: string;
  avatarField: string;
}

export interface AppConfig {
  port: number;
  issuer: string;
  cookieSecret: string;
  corsOrigins: string[];
  /** 管理端 JWT 配置 */
  adminAuth: {
    jwtSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    cookieName: string;
    secureCookie: boolean;
  };
  pg: { host: string; port: number; user: string; password: string; database: string };
  legacy: LegacyConfig;
}

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[config] 缺少必填环境变量: ${key}（请复制 backend/.env.example 为 backend/.env 并填写）`);
  }
  return v;
}

function num(key: string, fallback?: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[config] 缺少必填环境变量: ${key}`);
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`[config] 环境变量 ${key} 不是合法数字: ${v}`);
  return n;
}

export function loadConfig(): AppConfig {
  const hash = str('LEGACY_PASSWORD_HASH', 'bcrypt');
  const allowed = [
    'bcrypt',
    'md5',
    'sha1',
    'sha256',
    'sha256-b64',
    'hmac-sha256-b64',
    'plain',
  ];
  if (!allowed.includes(hash)) {
    throw new Error(`[config] LEGACY_PASSWORD_HASH 仅支持 ${allowed.join('|')}，当前: ${hash}`);
  }
  const issuer = str('ISSUER', 'http://localhost:3000');
  if (issuer.endsWith('/')) {
    throw new Error('[config] ISSUER 不能以 / 结尾');
  }
  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    port: num('PORT', 3000),
    issuer,
    cookieSecret: str('OIDC_COOKIE_SECRET'),
    corsOrigins,
    adminAuth: {
      jwtSecret: str('ADMIN_JWT_SECRET'),
      accessTtlSeconds: num('ADMIN_ACCESS_TTL', 900),
      refreshTtlDays: num('ADMIN_REFRESH_TTL_DAYS', 7),
      cookieName: process.env.ADMIN_REFRESH_COOKIE || 'wb_oidc_admin_rt',
      // 生产（https）应置 true，本地 http 调试为 false
      secureCookie: (process.env.ADMIN_COOKIE_SECURE || 'false') === 'true',
    },
    pg: {
      host: str('PG_HOST', 'localhost'),
      port: num('PG_PORT', 5432),
      user: str('PG_USER', 'postgres'),
      password: str('PG_PASSWORD', 'postgres'),
      database: str('PG_DATABASE', 'wb_oidc'),
    },
    legacy: {
      host: str('LEGACY_DB_HOST', 'localhost'),
      port: num('LEGACY_DB_PORT', 5432),
      user: str('LEGACY_DB_USER', 'postgres'),
      password: str('LEGACY_DB_PASSWORD', 'postgres'),
      database: str('LEGACY_DB_NAME'),
      userTable: str('LEGACY_USER_TABLE', 'users'),
      idField: str('LEGACY_ID_FIELD', 'id'),
      usernameField: str('LEGACY_USERNAME_FIELD', 'username'),
      passwordField: str('LEGACY_PASSWORD_FIELD', 'password'),
      passwordHash: hash as LegacyConfig['passwordHash'],
      hmacKey: process.env.LEGACY_HMAC_KEY || '',
      saltField: process.env.LEGACY_SALT_FIELD || '',
      staticSalt: process.env.LEGACY_STATIC_SALT || '',
      saltPosition: (process.env.LEGACY_SALT_POSITION || 'prefix') as 'prefix' | 'suffix',
      statusField: process.env.LEGACY_STATUS_FIELD || '',
      statusActive: process.env.LEGACY_STATUS_ACTIVE || '1',
      nicknameField: str('LEGACY_NICKNAME_FIELD', 'nickname'),
      emailField: str('LEGACY_EMAIL_FIELD', 'email'),
      phoneField: str('LEGACY_PHONE_FIELD', 'phone'),
      avatarField: str('LEGACY_AVATAR_FIELD', 'avatar'),
    },
  };
}
