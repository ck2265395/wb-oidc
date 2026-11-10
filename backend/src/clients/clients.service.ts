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
  category: 'web_app' | 'mobile_app' | 'mini_program';
  logo: string;
  description: string;
  website: string;
  icp_number: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateClientDto {
  client_name: string;
  redirect_uris: string[];
  application_type?: 'web' | 'spa';
  category?: 'web_app' | 'mobile_app' | 'mini_program';
  logo?: string;
  description?: string;
  website?: string;
  icp_number?: string;
  tags?: string[];
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

    const category = dto.category || 'web_app';
    // 应用类目决定安全形态：网站应用走 client_secret，移动/小程序走 PKCE
    const applicationType =
      dto.application_type === 'spa'
        ? 'spa'
        : category === 'web_app'
          ? 'web'
          : 'spa';

    const description = (dto.description || '').slice(0, 200);
    const website = (dto.website || '').trim();
    if (website && !/^https?:\/\/.+/i.test(website)) {
      throw new BadRequestException('官网域名不合法，需以 http(s):// 开头');
    }
    const icpNumber = (dto.icp_number || '').trim();
    const tags = Array.isArray(dto.tags)
      ? dto.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];
    const logo = (dto.logo || '').trim();
    if (logo && logo.length > 700000) {
      throw new BadRequestException('应用图标过大，请上传 100×100 以内的图片');
    }

    // 企业开发者创建应用必须填写 ICP 备案号（参照 QQ 开放平台）
    if (opts?.developerId) {
      const { rows: devRows } = await getPool().query<{ developer_type?: string }>(
        'SELECT developer_type FROM oidc_developer WHERE id = $1 LIMIT 1',
        [opts.developerId],
      );
      if (devRows[0]?.developer_type === 'enterprise' && !icpNumber) {
        throw new BadRequestException('企业开发者创建应用必须填写 ICP 备案号');
      }
    }

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
         grant_types, response_types, scope, developer_id, status,
         category, logo, description, website, icp_number, tags)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
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
        category,
        logo,
        description,
        website,
        icpNumber,
        JSON.stringify(tags),
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

  /** 通用编辑：应用名称 / 回调地址 / scope / 展示元数据（revertToPending：改动回调/scope 后回待审核） */
  async update(
    clientId: string,
    dto: {
      client_name?: string;
      redirect_uris?: string[];
      scope?: string;
      category?: 'web_app' | 'mobile_app' | 'mini_program';
      logo?: string;
      description?: string;
      website?: string;
      icp_number?: string;
      tags?: string[];
    },
    opts?: { revertToPending?: boolean; developerId?: number },
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
    if (dto.category !== undefined) {
      const cat = ['web_app', 'mobile_app', 'mini_program'].includes(dto.category as string)
        ? dto.category
        : 'web_app';
      sets.push(`category = $${idx++}`);
      params.push(cat);
      // 改类目同步调整安全形态（网站应用需要 secret，移动/小程序走 PKCE）
      sets.push(
        `application_type = $${idx++}`,
        `token_endpoint_auth_method = $${idx++}`,
      );
      const isWeb = cat === 'web_app';
      params.push(isWeb ? 'web' : 'spa', isWeb ? 'client_secret_basic' : 'none');
    }
    if (dto.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(String(dto.description).slice(0, 200));
    }
    if (dto.website !== undefined) {
      const site = String(dto.website).trim();
      if (site && !/^https?:\/\/.+/i.test(site)) {
        throw new BadRequestException('官网域名不合法，需以 http(s):// 开头');
      }
      sets.push(`website = $${idx++}`);
      params.push(site);
    }
    if (dto.icp_number !== undefined) {
      sets.push(`icp_number = $${idx++}`);
      params.push(String(dto.icp_number).trim());
    }
    if (dto.logo !== undefined) {
      const logo = String(dto.logo).trim();
      if (logo.length > 700000) {
        throw new BadRequestException('应用图标过大，请上传 100×100 以内的图片');
      }
      sets.push(`logo = $${idx++}`);
      params.push(logo);
    }
    if (dto.tags !== undefined) {
      const tags = Array.isArray(dto.tags)
        ? dto.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : [];
      sets.push(`tags = $${idx++}::jsonb`);
      params.push(JSON.stringify(tags));
    }
    if (!sets.length) {
      throw new BadRequestException('没有可更新的字段');
    }

    // 企业开发者清空 ICP 备案号时拒绝（创建与编辑都需保留）
    if (opts?.developerId && dto.icp_number !== undefined && dto.icp_number.trim() === '') {
      const { rows: devRows } = await getPool().query<{ developer_type?: string }>(
        'SELECT developer_type FROM oidc_developer WHERE id = $1 LIMIT 1',
        [opts.developerId],
      );
      if (devRows[0]?.developer_type === 'enterprise') {
        throw new BadRequestException('企业开发者应用必须保留 ICP 备案号');
      }
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
