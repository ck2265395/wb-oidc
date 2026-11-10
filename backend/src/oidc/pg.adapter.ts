import { In, LessThan } from 'typeorm';
import { getDataSource } from '../db/data-source';
import { OidcClient, OidcProviderState } from '../db/entities';
import { decryptSecret } from '../common/secret-cipher';

/**
 * oidc-provider PostgreSQL Adapter。
 * 所有协议运行时数据（Session / Interaction / AuthorizationCode /
 * AccessToken / RefreshToken / Grant ...）统一落在 oidc_provider_state 表。
 * Client 模型特殊处理：从 oidc_clients 业务表读取。
 * 注意：oidc-provider 直接 new 这个类（不走 Nest DI），因此用 getDataSource() 模块级获取。
 */
export class PgAdapter {
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  private get repo() {
    return getDataSource().getRepository(OidcProviderState);
  }

  async upsert(id: string, payload: Record<string, any>, expiresIn: number): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    await this.repo.save({
      id,
      model: this.model,
      data: payload,
      expiresAt,
      uid: payload.uid || null,
      grantId: payload.grantId || null,
      userCode: payload.userCode || null,
      consumedAt: payload.consumed ? new Date() : null,
    });
  }

  async find(id: string): Promise<Record<string, any> | undefined> {
    // Client 模型不在 state 表，从业务表 oidc_clients 加载
    if (this.model === 'Client') return this.findClient(id);
    const row = await this.repo.findOne({ where: { model: this.model, id } });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    return row.data;
  }

  /**
   * 从 oidc_clients 加载 OIDC Client。
   * 只有 status='approved' 且 enabled 的应用可参与协议流程；
   * pending / rejected / suspended 一律按不存在处理（invalid_client）。
   */
  private async findClient(clientId: string): Promise<Record<string, any> | undefined> {
    const e = await getDataSource()
      .getRepository(OidcClient)
      .findOne({ where: { clientId } });
    if (!e) return undefined;
    if (e.status !== 'approved') return undefined;
    if (!e.enabled) return undefined;
    return {
      client_id: e.clientId,
      client_secret: decryptSecret(e.clientSecret),
      client_name: e.clientName,
      application_type: e.applicationType,
      token_endpoint_auth_method: e.tokenEndpointAuthMethod,
      redirect_uris: e.redirectUris,
      post_logout_redirect_uris: e.postLogoutRedirectUris,
      grant_types: e.grantTypes,
      response_types: e.responseTypes,
      scope: e.scope,
    };
  }

  async findByUid(uid: string): Promise<Record<string, any> | undefined> {
    return this.findBy(['Session', 'Interaction'], { uid });
  }

  async findByUserCode(userCode: string): Promise<Record<string, any> | undefined> {
    return this.findBy(['DeviceCode'], { userCode });
  }

  async findByGrantId(grantId: string): Promise<Record<string, any>[] | undefined> {
    const rows = await this.repo.find({ where: { grantId } });
    if (!rows.length) return undefined;
    const now = Date.now();
    return rows
      .filter((r) => !r.expiresAt || r.expiresAt.getTime() >= now)
      .map((r) => r.data);
  }

  async consume(id: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(OidcProviderState)
      .set({
        data: () => `jsonb_set(data, '{consumed}', 'true'::jsonb)`,
        consumedAt: () => 'NOW()',
      })
      .where('model = :model AND id = :id', { model: this.model, id })
      .execute();
  }

  async destroy(id: string): Promise<void> {
    await this.repo.delete({ model: this.model, id });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await this.repo.delete({ grantId });
  }

  private async findBy(
    models: string[],
    cond: { uid?: string; userCode?: string },
  ): Promise<Record<string, any> | undefined> {
    const row = await this.repo.findOne({
      where: { model: In(models), ...cond },
      order: { expiresAt: 'DESC' },
    });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    return row.data;
  }
}
