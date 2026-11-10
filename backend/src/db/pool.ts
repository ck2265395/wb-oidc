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
  category VARCHAR(24) NOT NULL DEFAULT 'web_app', -- web_app | mobile_app | mini_program
  logo TEXT NOT NULL DEFAULT '',                  -- 应用图标（base64 data URL）
  description TEXT NOT NULL DEFAULT '',            -- 应用简介（≤200 字）
  website TEXT NOT NULL DEFAULT '',                -- 官网域名
  icp_number TEXT NOT NULL DEFAULT '',             -- ICP 备案号（企业开发者必填）
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,         -- 自由标签，用于分组/筛选
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

-- 门户账号：注册即可登录（status=active）；开发者资格单独走审核（developer_status）
-- status:           active | suspended   —— 能否登录
-- developer_status: none | pending | approved | rejected —— 能否创建应用
CREATE TABLE IF NOT EXISTS oidc_developer (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(128) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company VARCHAR(128) NOT NULL DEFAULT '',
  contact VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  developer_status VARCHAR(16) NOT NULL DEFAULT 'none',
  developer_reject_reason TEXT NOT NULL DEFAULT '',
  developer_applied_at TIMESTAMPTZ,
  developer_type VARCHAR(16),                      -- personal | enterprise（区分个人/企业开发者）
  reject_reason TEXT NOT NULL DEFAULT '',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_developer_status ON oidc_developer (status);
-- 注意：developer_status 的索引放在下方 ALTER 之后，老表加列前不能引用该列

-- 开发者刷新令牌（与管理员会话同构）
CREATE TABLE IF NOT EXISTS oidc_developer_session (
  id BIGSERIAL PRIMARY KEY,
  developer_id BIGINT NOT NULL REFERENCES oidc_developer(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dev_session_developer ON oidc_developer_session (developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_session_expires ON oidc_developer_session (expires_at);

-- 应用审核流：developer_id 归属 + status 审核状态（存量应用默认 approved 不受影响）
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS developer_id BIGINT REFERENCES oidc_developer(id) ON DELETE SET NULL;
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'approved'; -- pending | approved | rejected | suspended
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS reject_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_clients_developer ON oidc_clients (developer_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON oidc_clients (status);

-- 应用展示元数据（对齐 QQ/微信/Google 创建应用表单）：类目、图标、简介、官网、ICP、标签
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS category VARCHAR(24) NOT NULL DEFAULT 'web_app';
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS logo TEXT NOT NULL DEFAULT '';
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS icp_number TEXT NOT NULL DEFAULT '';
ALTER TABLE oidc_clients ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 开发者类型：个人 / 企业（影响创建应用时 ICP 备案号是否必填，参照 QQ）
ALTER TABLE oidc_developer ADD COLUMN IF NOT EXISTS developer_type VARCHAR(16);

-- v2 幂等迁移：老库里 status 曾兼任「开发者审核状态」，现拆成账号状态 + 开发者资格。
-- ADD COLUMN 的 DEFAULT 'approved' 只用于老库回填（保住已审核通过的开发者）；
-- 新库走上面 CREATE TABLE 的 DEFAULT 'none'，普通用户不会被误升级。
ALTER TABLE oidc_developer ADD COLUMN IF NOT EXISTS developer_status VARCHAR(16) NOT NULL DEFAULT 'approved';
ALTER TABLE oidc_developer ADD COLUMN IF NOT EXISTS developer_reject_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE oidc_developer ADD COLUMN IF NOT EXISTS developer_applied_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_developer_dev_status ON oidc_developer (developer_status);
-- 老库 pending 的注册申请 → 账号可用 + 开发者资格待审（新流程不再产生 status='pending'，可反复执行）
UPDATE oidc_developer
   SET status = 'active',
       developer_status = 'pending',
       developer_applied_at = COALESCE(developer_applied_at, created_at)
 WHERE status = 'pending';
`;

async function ensureSchema(pool: Pool): Promise<void> {
  await pool.query(SCHEMA_SQL);
}
