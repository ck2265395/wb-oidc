import { Pool } from 'pg';
import { loadConfig } from '../config/env';

let _pool: Pool | null = null;
let _ready: Promise<void> | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const cfg = loadConfig().pg;
    _pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    _pool.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[pg] pool error:', err.message);
    });
    _ready = ensureSchema(_pool).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[pg] 初始化表结构失败:', err.message);
      throw err;
    });
  }
  return _pool;
}

/** 等待建表完成（启动/种子脚本用它，避免与 ensureSchema 竞态） */
export async function waitReady(): Promise<void> {
  getPool();
  if (_ready) await _ready;
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS oidc_clients (
  id BIGSERIAL PRIMARY KEY,
  client_id VARCHAR(64) UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  client_name VARCHAR(128) NOT NULL,
  application_type VARCHAR(16) NOT NULL DEFAULT 'web',
  token_endpoint_auth_method VARCHAR(32) NOT NULL DEFAULT 'client_secret_basic',
  redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  post_logout_redirect_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  grant_types JSONB NOT NULL DEFAULT '["authorization_code","refresh_token"]'::jsonb,
  response_types JSONB NOT NULL DEFAULT '["code"]'::jsonb,
  scope TEXT NOT NULL DEFAULT 'openid profile email',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oidc_provider_state (
  id VARCHAR(128) NOT NULL,
  model VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  uid VARCHAR(128),
  grant_id VARCHAR(128),
  user_code VARCHAR(128),
  consumed_at TIMESTAMPTZ,
  PRIMARY KEY (model, id)
);

CREATE INDEX IF NOT EXISTS idx_state_uid ON oidc_provider_state (model, uid);
CREATE INDEX IF NOT EXISTS idx_state_grant ON oidc_provider_state (grant_id);
CREATE INDEX IF NOT EXISTS idx_state_user_code ON oidc_provider_state (model, user_code);
CREATE INDEX IF NOT EXISTS idx_state_expires ON oidc_provider_state (expires_at);

-- 管理端账号（独立于老系统，密码 bcrypt）
CREATE TABLE IF NOT EXISTS oidc_admin (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(64) NOT NULL DEFAULT '',
  role VARCHAR(16) NOT NULL DEFAULT 'operator',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 管理端刷新令牌（服务端存哈希，可单独吊销，刷新即轮换）
CREATE TABLE IF NOT EXISTS oidc_admin_session (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL REFERENCES oidc_admin(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_session_admin ON oidc_admin_session (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_session_expires ON oidc_admin_session (expires_at);

-- 管理端操作审计
CREATE TABLE IF NOT EXISTS oidc_admin_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT,
  username VARCHAR(64),
  action VARCHAR(64) NOT NULL,
  target VARCHAR(128),
  detail JSONB,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_created ON oidc_admin_log (created_at DESC);
`;

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
