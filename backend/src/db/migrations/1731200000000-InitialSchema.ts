import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 初始库结构：全新建表。
 *
 * 本文件仅用于全新环境首次建库，视为只读——后续字段变更一律新增
 * `<timestamp>-<Name>.ts` 增量迁移文件并同步注册到 data-source.ts 的 migrations 数组，
 * 禁止回头修改本文件（对已应用它的存量库无效）。
 */
export class InitialSchema1731200000000 implements MigrationInterface {
  name = 'InitialSchema1731200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE oidc_clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        category VARCHAR(24) NOT NULL DEFAULT 'web_app',
        logo TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        website TEXT NOT NULL DEFAULT '',
        icp_number TEXT NOT NULL DEFAULT '',
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        developer_id UUID,
        status VARCHAR(16) NOT NULL DEFAULT 'approved',
        reject_reason TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_clients_developer ON oidc_clients (developer_id);
      CREATE INDEX idx_clients_status ON oidc_clients (status);

      CREATE TABLE oidc_provider_state (
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
      CREATE INDEX idx_state_uid ON oidc_provider_state (model, uid);
      CREATE INDEX idx_state_grant ON oidc_provider_state (grant_id);
      CREATE INDEX idx_state_user_code ON oidc_provider_state (model, user_code);
      CREATE INDEX idx_state_expires ON oidc_provider_state (expires_at);

      CREATE TABLE oidc_admin (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(64) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name VARCHAR(64) NOT NULL DEFAULT '',
        role VARCHAR(16) NOT NULL DEFAULT 'operator',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE oidc_admin_session (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES oidc_admin(id) ON DELETE CASCADE,
        token_hash CHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        ip VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_admin_session_admin ON oidc_admin_session (admin_id);
      CREATE INDEX idx_admin_session_expires ON oidc_admin_session (expires_at);

      CREATE TABLE oidc_admin_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_type VARCHAR(16) NOT NULL DEFAULT 'admin',
        admin_id UUID,
        username VARCHAR(64),
        action VARCHAR(64) NOT NULL,
        target VARCHAR(128),
        detail JSONB,
        ip VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_admin_log_created ON oidc_admin_log (created_at DESC);

      CREATE TABLE oidc_developer (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(128) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        company VARCHAR(128) NOT NULL DEFAULT '',
        contact VARCHAR(64) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        developer_status VARCHAR(16) NOT NULL DEFAULT 'none',
        developer_reject_reason TEXT NOT NULL DEFAULT '',
        developer_applied_at TIMESTAMPTZ,
        developer_type VARCHAR(16),
        reject_reason TEXT NOT NULL DEFAULT '',
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_developer_status ON oidc_developer (status);
      CREATE INDEX idx_developer_dev_status ON oidc_developer (developer_status);

      CREATE TABLE oidc_developer_session (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        developer_id UUID NOT NULL REFERENCES oidc_developer(id) ON DELETE CASCADE,
        token_hash CHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        ip VARCHAR(64),
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_dev_session_developer ON oidc_developer_session (developer_id);
      CREATE INDEX idx_dev_session_expires ON oidc_developer_session (expires_at);

      ALTER TABLE oidc_clients
        ADD CONSTRAINT fk_clients_developer
        FOREIGN KEY (developer_id) REFERENCES oidc_developer(id) ON DELETE SET NULL;
    `);
  }

  /**
   * 故意不提供回滚：down 等于删库（全表 DROP）。回滚初始迁移没有业务意义，
   * 需要重建库用 npm run db:reinit（带生产护栏）。migration:revert 到这里会直接报错。
   */
  async down(): Promise<void> {
    throw new Error(
      '禁止回滚初始迁移（down = 全表 DROP）。重建库请使用 npm run db:reinit。',
    );
  }
}
