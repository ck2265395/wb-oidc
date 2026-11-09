import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { getPool } from '../db/pool';

export interface ClientRow {
  id: number;
  client_id: string;
  client_secret: string;
  client_name: string;
  application_type: string;
  token_endpoint_auth_method: string;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  enabled: boolean;
  developer_id: number | null;
  developer_email?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  reject_reason: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClientDto {
  client_name: string;
  redirect_uris: string[];
  application_type?: 'web' | 'spa';
  scope?: string;
  post_logout_redirect_uris?: string[];
}

/**
 * 第三方应用（OIDC Client）管理。
 * client_secret 明文存库（仅限内部管理端访问），生产建议加密存储 + 轮换。
 */
@Injectable()
export class ClientsService {
  async list(): Promise<ClientRow[]> {
    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      `SELECT c.*, d.email AS developer_email
         FROM oidc_clients c
         LEFT JOIN oidc_developer d ON d.id = c.developer_id
        ORDER BY c.created_at DESC`,
    );
    return rows;
  }

  async listByDeveloper(developerId: number): Promise<ClientRow[]> {
    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      'SELECT * FROM oidc_clients WHERE developer_id = $1 ORDER BY created_at DESC',
      [developerId],
    );
    return rows;
  }

  async listPending(): Promise<ClientRow[]> {
    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      "SELECT * FROM oidc_clients WHERE status = 'pending' ORDER BY created_at ASC",
    );
    return rows;
  }

  async get(clientId: string): Promise<ClientRow | null> {
    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      'SELECT * FROM oidc_clients WHERE client_id = $1 LIMIT 1',
      [clientId],
    );
    return rows[0] || null;
  }

  async create(
    dto: CreateClientDto,
    opts?: { developerId?: number; status?: 'pending' | 'approved' },
  ): Promise<{ client: ClientRow; secret: string }> {
    if (!dto.client_name) throw new BadRequestException('client_name 必填');
    if (!Array.isArray(dto.redirect_uris) || dto.redirect_uris.length === 0) {
      throw new BadRequestException('redirect_uris 至少需要一个回调地址');
    }
    for (const uri of dto.redirect_uris) {
      if (!/^https?:\/\/.+/i.test(uri)) {
        throw new BadRequestException(`回调地址不合法: ${uri}`);
      }
    }
    const applicationType = dto.application_type === 'spa' ? 'spa' : 'web';
    const clientId = `app_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const authMethod = applicationType === 'spa' ? 'none' : 'client_secret_basic';
    const scope = dto.scope || 'openid profile email';
    const status = opts?.status || 'approved';

    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      `INSERT INTO oidc_clients
        (client_id, client_secret, client_name, application_type,
         token_endpoint_auth_method, redirect_uris, post_logout_redirect_uris,
         grant_types, response_types, scope, developer_id, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12)
       RETURNING *`,
      [
        clientId,
        secret,
        dto.client_name,
        applicationType,
        authMethod,
        JSON.stringify(dto.redirect_uris),
        JSON.stringify(dto.post_logout_redirect_uris || []),
        JSON.stringify(['authorization_code', 'refresh_token']),
        JSON.stringify(['code']),
        scope,
        opts?.developerId ?? null,
        status,
      ],
    );
    return { client: rows[0], secret };
  }

  async toggleEnabled(clientId: string, enabled: boolean): Promise<ClientRow> {
    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      'UPDATE oidc_clients SET enabled = $2, updated_at = NOW() WHERE client_id = $1 RETURNING *',
      [clientId, enabled],
    );
    if (!rows.length) throw new NotFoundException(`client ${clientId} 不存在`);
    return rows[0];
  }

  /** 通用编辑：应用名称 / 回调地址 / scope（revertToPending：改动回调/scope 后回待审核） */
  async update(
    clientId: string,
    dto: { client_name?: string; redirect_uris?: string[]; scope?: string },
    opts?: { revertToPending?: boolean },
  ): Promise<ClientRow> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.client_name !== undefined) {
      const name = String(dto.client_name).trim();
      if (!name || name.length > 64) {
        throw new BadRequestException('client_name 需为 1-64 字符');
      }
      sets.push(`client_name = $${idx++}`);
      params.push(name);
    }
    if (dto.redirect_uris !== undefined) {
      const uris = dto.redirect_uris;
      if (!Array.isArray(uris) || uris.length === 0) {
        throw new BadRequestException('redirect_uris 至少需要一个回调地址');
      }
      for (const uri of uris) {
        if (!/^https?:\/\/.+/i.test(uri)) {
          throw new BadRequestException(`回调地址不合法: ${uri}`);
        }
      }
      sets.push(`redirect_uris = $${idx++}::jsonb`);
      params.push(JSON.stringify(uris));
    }
    if (dto.scope !== undefined) {
      const scopes = String(dto.scope)
        .split(/\s+/)
        .filter(Boolean);
      if (!scopes.includes('openid')) {
        throw new BadRequestException('scope 必须包含 openid');
      }
      sets.push(`scope = $${idx++}`);
      params.push(scopes.join(' '));
    }
    if (!sets.length) {
      throw new BadRequestException('没有可更新的字段');
    }

    sets.push('updated_at = NOW()');
    // 审核流策略：改了回调或 scope → 回到待审核（应用名称改动不影响安全面，不触发）
    if (opts?.revertToPending && (dto.redirect_uris !== undefined || dto.scope !== undefined)) {
      sets.push("status = 'pending'");
      sets.push("reject_reason = ''");
    }
    const { rows } = await getPool().query<ClientRow>(
      `UPDATE oidc_clients SET ${sets.join(', ')} WHERE client_id = $${idx} RETURNING *`,
      [...params, clientId],
    );
    if (!rows.length) throw new NotFoundException(`client ${clientId} 不存在`);
    return rows[0];
  }

  /** 审核操作：approve / reject / suspend */
  async setStatus(
    clientId: string,
    status: 'approved' | 'rejected' | 'suspended' | 'pending',
    reason = '',
  ): Promise<ClientRow> {
    const { rows } = await getPool().query<ClientRow>(
      `UPDATE oidc_clients
          SET status = $2, reject_reason = $3, updated_at = NOW()
        WHERE client_id = $1 RETURNING *`,
      [clientId, status, reason],
    );
    if (!rows.length) throw new NotFoundException(`client ${clientId} 不存在`);
    return rows[0];
  }

  /** 开发者归属校验：不是自己的应用直接按不存在处理（不暴露存在性） */
  assertOwned(row: ClientRow, developerId: number): void {
    // developer_id 是 BIGINT，pg 驱动会返回字符串，必须按数值比较
    const owner = row.developer_id === null || row.developer_id === undefined
      ? null
      : Number(row.developer_id);
    if (owner !== Number(developerId)) {
      throw new NotFoundException(`client ${row.client_id} 不存在`);
    }
  }

  async rotateSecret(clientId: string): Promise<{ client: ClientRow; secret: string }> {
    const secret = randomBytes(24).toString('hex');
    const { rows } = await getPool().query<ClientRow>(
      `UPDATE oidc_clients
          SET client_secret = $2, updated_at = NOW()
        WHERE client_id = $1 RETURNING *`,
      [clientId, secret],
    );
    if (!rows.length) throw new NotFoundException(`client ${clientId} 不存在`);
    return { client: rows[0], secret };
  }

  async remove(clientId: string): Promise<void> {
    const pool = getPool();
    const result = await pool.query('DELETE FROM oidc_clients WHERE client_id = $1', [clientId]);
    if (!result.rowCount) throw new NotFoundException(`client ${clientId} 不存在`);
  }

  /** adapter 用的 OIDC 客户端配置 */
  async toOidcClient(row: ClientRow): Promise<Record<string, any>> {
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
}
