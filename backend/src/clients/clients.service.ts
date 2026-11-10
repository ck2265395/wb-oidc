import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, In } from 'typeorm';
import { OidcClient, OidcDeveloper } from '../db/entities';
import { encryptSecret, decryptSecret } from '../common/secret-cipher';

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

/** 实体 → 对外 snake_case 行（API 响应结构保持不变，secret 由调用方按需剥离） */
export function toClientRow(e: OidcClient, developerEmail?: string | null): ClientRow {
  return {
    id: Number(e.id),
    client_id: e.clientId,
    client_secret: e.clientSecret,
    client_name: e.clientName,
    application_type: e.applicationType,
    token_endpoint_auth_method: e.tokenEndpointAuthMethod,
    redirect_uris: e.redirectUris,
    post_logout_redirect_uris: e.postLogoutRedirectUris,
    grant_types: e.grantTypes,
    response_types: e.responseTypes,
    scope: e.scope,
    enabled: e.enabled,
    developer_id: e.developerId,
    developer_email: developerEmail ?? null,
    status: e.status,
    reject_reason: e.rejectReason,
    category: e.category,
    logo: e.logo,
    description: e.description,
    website: e.website,
    icp_number: e.icpNumber,
    tags: e.tags,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

/**
 * 第三方应用（OIDC Client）管理。
 * client_secret 落库前用 AES-256-GCM 加密（见 common/secret-cipher.ts），
 * 历史明文数据由 decryptSecret 透明兼容，启动时会被一次性迁移为密文。
 */
@Injectable()
export class ClientsService {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  private get repo() {
    return this.ds.getRepository(OidcClient);
  }

  async list(): Promise<ClientRow[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    // 补申请人邮箱：admin 列表页需要展示归属开发者
    const devIds = [...new Set(rows.map((r) => r.developerId).filter((v): v is number => v != null))];
    const devs = devIds.length
      ? await this.ds
          .getRepository(OidcDeveloper)
          .find({ where: { id: In(devIds) }, select: { id: true, email: true } })
      : [];
    const emailMap = new Map(devs.map((d) => [Number(d.id), d.email]));
    return rows.map((e) => toClientRow(e, emailMap.get(Number(e.developerId)) ?? null));
  }

  async listByDeveloper(developerId: number): Promise<ClientRow[]> {
    const rows = await this.repo.find({
      where: { developerId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((e) => toClientRow(e));
  }

  async listPending(): Promise<ClientRow[]> {
    const rows = await this.repo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
    return rows.map((e) => toClientRow(e));
  }

  async get(clientId: string): Promise<ClientRow | null> {
    const e = await this.repo.findOne({ where: { clientId } });
    return e ? toClientRow(e) : null;
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
      const dev = await this.ds.getRepository(OidcDeveloper).findOne({
        where: { id: opts.developerId },
        select: { id: true, developerType: true },
      });
      if (dev?.developerType === 'enterprise' && !icpNumber) {
        throw new BadRequestException('企业开发者创建应用必须填写 ICP 备案号');
      }
    }

    const clientId = `app_${randomBytes(8).toString('hex')}`;
    // PKCE 类目（移动/小程序）不发 secret：发了也不会用于认证，只会误导接入方去配一个无效密钥
    const authMethod = applicationType === 'spa' ? 'none' : 'client_secret_basic';
    const secret = authMethod === 'none' ? '' : randomBytes(24).toString('hex');
    const scope = dto.scope || 'openid profile email';
    const status = opts?.status || 'approved';

    const entity = await this.repo.save(this.repo.create({
      clientId,
      clientSecret: encryptSecret(secret),
      clientName: dto.client_name,
      applicationType,
      tokenEndpointAuthMethod: authMethod,
      redirectUris: dto.redirect_uris,
      postLogoutRedirectUris: dto.post_logout_redirect_uris || [],
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      scope,
      developerId: opts?.developerId ?? null,
      status,
      category,
      logo,
      description,
      website,
      icpNumber,
      tags,
    }));
    return { client: toClientRow(entity), secret };
  }

  async toggleEnabled(clientId: string, enabled: boolean): Promise<ClientRow> {
    await this.repo.update({ clientId }, { enabled });
    const e = await this.repo.findOne({ where: { clientId } });
    if (!e) throw new NotFoundException(`client ${clientId} 不存在`);
    return toClientRow(e);
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
    const current = await this.repo.findOne({ where: { clientId } });
    if (!current) throw new NotFoundException(`client ${clientId} 不存在`);

    const patch: Partial<OidcClient> = {};
    if (dto.client_name !== undefined) {
      const name = String(dto.client_name).trim();
      if (!name || name.length > 64) {
        throw new BadRequestException('client_name 需为 1-64 字符');
      }
      patch.clientName = name;
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
      patch.redirectUris = uris;
    }
    if (dto.scope !== undefined) {
      const scopes = String(dto.scope)
        .split(/\s+/)
        .filter(Boolean);
      if (!scopes.includes('openid')) {
        throw new BadRequestException('scope 必须包含 openid');
      }
      patch.scope = scopes.join(' ');
    }
    if (dto.category !== undefined) {
      const cat = ['web_app', 'mobile_app', 'mini_program'].includes(dto.category as string)
        ? dto.category
        : 'web_app';
      patch.category = cat;
      // 改类目同步调整安全形态（网站应用需要 secret，移动/小程序走 PKCE）
      const isWeb = cat === 'web_app';
      patch.applicationType = isWeb ? 'web' : 'spa';
      patch.tokenEndpointAuthMethod = isWeb ? 'client_secret_basic' : 'none';
      if (isWeb) {
        // 从 PKCE 类目改成网站应用：原来没有 secret，补发一个，否则认证必然失败
        if (!current.clientSecret) {
          patch.clientSecret = encryptSecret(randomBytes(24).toString('hex'));
        }
      } else {
        // 改成 PKCE 类目：清掉 secret，免得库里留一个永远不会用到的凭据
        patch.clientSecret = '';
      }
    }
    if (dto.description !== undefined) {
      patch.description = String(dto.description).slice(0, 200);
    }
    if (dto.website !== undefined) {
      const site = String(dto.website).trim();
      if (site && !/^https?:\/\/.+/i.test(site)) {
        throw new BadRequestException('官网域名不合法，需以 http(s):// 开头');
      }
      patch.website = site;
    }
    if (dto.icp_number !== undefined) {
      patch.icpNumber = String(dto.icp_number).trim();
    }
    if (dto.logo !== undefined) {
      const logo = String(dto.logo).trim();
      if (logo.length > 700000) {
        throw new BadRequestException('应用图标过大，请上传 100×100 以内的图片');
      }
      patch.logo = logo;
    }
    if (dto.tags !== undefined) {
      patch.tags = Array.isArray(dto.tags)
        ? dto.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
        : [];
    }
    if (!Object.keys(patch).length) {
      throw new BadRequestException('没有可更新的字段');
    }

    // 企业开发者清空 ICP 备案号时拒绝（创建与编辑都需保留）
    if (opts?.developerId && dto.icp_number !== undefined && dto.icp_number.trim() === '') {
      const dev = await this.ds.getRepository(OidcDeveloper).findOne({
        where: { id: opts.developerId },
        select: { id: true, developerType: true },
      });
      if (dev?.developerType === 'enterprise') {
        throw new BadRequestException('企业开发者应用必须保留 ICP 备案号');
      }
    }

    // 审核流策略：改了回调或 scope → 回到待审核（应用名称改动不影响安全面，不触发）
    if (opts?.revertToPending && (dto.redirect_uris !== undefined || dto.scope !== undefined)) {
      patch.status = 'pending';
      patch.rejectReason = '';
    }
    await this.repo.update({ clientId }, patch);
    const updated = await this.repo.findOne({ where: { clientId } });
    if (!updated) throw new NotFoundException(`client ${clientId} 不存在`);
    return toClientRow(updated);
  }

  /** 审核操作：approve / reject / suspend */
  async setStatus(
    clientId: string,
    status: 'approved' | 'rejected' | 'suspended' | 'pending',
    reason = '',
  ): Promise<ClientRow> {
    await this.repo.update({ clientId }, { status, rejectReason: reason });
    const e = await this.repo.findOne({ where: { clientId } });
    if (!e) throw new NotFoundException(`client ${clientId} 不存在`);
    return toClientRow(e);
  }

  /** 开发者归属校验：不是自己的应用直接按不存在处理（不暴露存在性） */
  assertOwned(row: ClientRow, developerId: number): void {
    const owner = row.developer_id === null || row.developer_id === undefined
      ? null
      : Number(row.developer_id);
    if (owner !== Number(developerId)) {
      throw new NotFoundException(`client ${row.client_id} 不存在`);
    }
  }

  async rotateSecret(clientId: string): Promise<{ client: ClientRow; secret: string }> {
    const secret = randomBytes(24).toString('hex');
    await this.repo.update({ clientId }, { clientSecret: encryptSecret(secret) });
    const e = await this.repo.findOne({ where: { clientId } });
    if (!e) throw new NotFoundException(`client ${clientId} 不存在`);
    return { client: toClientRow(e), secret };
  }

  /**
   * 取密钥明文（开发者查看用）。调用方必须先校验归属与二次验证。
   * 移动/小程序等 PKCE 类目没有 secret，返回 null。
   */
  async revealSecret(clientId: string): Promise<string | null> {
    const row = await this.get(clientId);
    if (!row) throw new NotFoundException(`client ${clientId} 不存在`);
    if (row.token_endpoint_auth_method === 'none' || !row.client_secret) return null;
    return decryptSecret(row.client_secret);
  }

  async remove(clientId: string): Promise<void> {
    const result = await this.repo.delete({ clientId });
    if (!result.affected) throw new NotFoundException(`client ${clientId} 不存在`);
  }

  /** adapter 用的 OIDC 客户端配置 */
  async toOidcClient(row: ClientRow): Promise<Record<string, any>> {
    return {
      client_id: row.client_id,
      client_secret: decryptSecret(row.client_secret),
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
