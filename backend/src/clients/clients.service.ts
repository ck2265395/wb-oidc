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
      'SELECT * FROM oidc_clients ORDER BY created_at DESC',
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

  async create(dto: CreateClientDto): Promise<{ client: ClientRow; secret: string }> {
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

    const pool = getPool();
    const { rows } = await pool.query<ClientRow>(
      `INSERT INTO oidc_clients
        (client_id, client_secret, client_name, application_type,
         token_endpoint_auth_method, redirect_uris, post_logout_redirect_uris,
         grant_types, response_types, scope)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10)
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
