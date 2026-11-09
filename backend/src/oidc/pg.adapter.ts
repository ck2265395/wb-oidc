import { getPool } from '../db/pool';

/**
 * oidc-provider PostgreSQL Adapter。
 * 所有协议运行时数据（Session / Interaction / AuthorizationCode /
 * AccessToken / RefreshToken / Grant ...）统一落在 oidc_provider_state 表。
 * Client 模型特殊处理：从 oidc_clients 业务表读取。
 */
export class PgAdapter {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  async upsert(id: string, payload: Record<string, any>, expiresIn: number): Promise<void> {
    const pool = getPool();
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const uid = payload.uid || null;
    const grantId = payload.grantId || null;
    const userCode = payload.userCode || null;
    await pool.query(
      `INSERT INTO oidc_provider_state (id, model, data, expires_at, uid, grant_id, user_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (model, id) DO UPDATE SET
         data = EXCLUDED.data,
         expires_at = EXCLUDED.expires_at,
         uid = EXCLUDED.uid,
         grant_id = EXCLUDED.grant_id,
         user_code = EXCLUDED.user_code`,
      [id, this.model, JSON.stringify(payload), expiresAt, uid, grantId, userCode],
    );
  }

  async find(id: string): Promise<Record<string, any> | undefined> {
    // Client 模型不在 state 表，从业务表 oidc_clients 加载
    if (this.model === 'Client') return this.findClient(id);
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT data, expires_at FROM oidc_provider_state WHERE model = $1 AND id = $2',
      [this.model, id],
    );
    if (!rows.length) return undefined;
    if (rows[0].expires_at && new Date(rows[0].expires_at).getTime() < Date.now()) {
      return undefined;
    }
    return rows[0].data;
  }

  /**
   * 从 oidc_clients 加载 OIDC Client。
   * 只有 status='approved' 且 enabled 的应用可参与协议流程；
   * pending / rejected / suspended 一律按不存在处理（invalid_client）。
   */
  private async findClient(clientId: string): Promise<Record<string, any> | undefined> {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM oidc_clients WHERE client_id = $1 LIMIT 1',
      [clientId],
    );
    if (!rows.length) return undefined;
    const row = rows[0];
    if (row.status && row.status !== 'approved') return undefined;
    if (row.enabled === false) return undefined;
    return {
      client_id: row.client_id,
      client_secret: row.client_secret,
      client_name: row.client_name,
      application_type: row.application_type,
      token_endpoint_auth_method: row.token_endpoint_auth_method,
      redirect_uris: row.redirect_uris,
      post_logout_redirect_uris: row.post_logout_redirect_uris,
      grant_types: row.grant_types,
      response_types: row.response_types,
      scope: row.scope,
    };
  }

  async findByUid(uid: string): Promise<Record<string, any> | undefined> {
    return this.findBy('uid', uid, ['Session', 'Interaction']);
  }

  async findByUserCode(userCode: string): Promise<Record<string, any> | undefined> {
    return this.findBy('user_code', userCode, ['DeviceCode']);
  }

  async findByGrantId(grantId: string): Promise<Record<string, any>[] | undefined> {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT data, expires_at FROM oidc_provider_state WHERE grant_id = $1',
      [grantId],
    );
    if (!rows.length) return undefined;
    const now = Date.now();
    return rows
      .filter((r: any) => !r.expires_at || new Date(r.expires_at).getTime() >= now)
      .map((r: any) => r.data);
  }

  async consume(id: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE oidc_provider_state
       SET data = jsonb_set(data, '{consumed}', 'true'::jsonb), consumed_at = NOW()
       WHERE model = $1 AND id = $2`,
      [this.model, id],
    );
  }

  async destroy(id: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM oidc_provider_state WHERE model = $1 AND id = $2', [
      this.model,
      id,
    ]);
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM oidc_provider_state WHERE grant_id = $1', [grantId]);
  }

  private async findBy(
    column: string,
    value: string,
    models: string[],
  ): Promise<Record<string, any> | undefined> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT data, expires_at FROM oidc_provider_state
       WHERE model = ANY($1) AND ${column} = $2`,
      [models, value],
    );
    if (!rows.length) return undefined;
    if (rows[0].expires_at && new Date(rows[0].expires_at).getTime() < Date.now()) {
      return undefined;
    }
    return rows[0].data;
  }
}
