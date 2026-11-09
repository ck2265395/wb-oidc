import { PgAdapter } from './pg.adapter';
import { LegacyUserService, AccountClaims } from './legacy/legacy-user.service';
import { AppConfig } from '../config/env';

/**
 * 创建 oidc-provider 实例。
 * 协议细节全部交给库；我们只提供三块自定义逻辑：
 * 1. adapter —— 协议数据落 PostgreSQL
 * 2. findAccount —— 按 accountId 从老系统取用户 claims
 * 3. interaction —— 登录/授权交互见 interaction.routes.ts
 */
export function createProvider(config: AppConfig, legacyUserService: LegacyUserService): any {
  // 延迟引入，oidc-provider 为 CJS 包且无官方类型
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Provider } = require('oidc-provider');

  const configuration = {
    adapter: PgAdapter,
    clients: [], // 客户端动态存储在 oidc_clients 表，由 adapter 的 Client 查询提供
    scopes: ['openid', 'profile', 'email', 'phone', 'offline_access'],
    claims: {
      openid: ['sub'],
      profile: ['name', 'nickname', 'picture'],
      email: ['email', 'email_verified'],
      phone: ['phone_number'],
    },
    findAccount: async (_ctx: unknown, id: string): Promise<any> => {
      const claims: AccountClaims | null = await legacyUserService.getClaims(id);
      if (!claims) return undefined;
      return {
        accountId: id,
        claims: async () => claims,
      };
    },
    cookies: {
      keys: [config.cookieSecret],
      long: { signed: true, sameSite: 'lax' },
      short: { signed: true, sameSite: 'lax' },
    },
    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },
    pkce: {
      required: (_ctx: unknown, client: any) => client.applicationType === 'spa',
    },
    ttl: {
      AccessToken: 3600, // 1h
      IdToken: 3600,
      AuthorizationCode: 600, // 10min
      RefreshToken: 30 * 24 * 3600, // 30d
      Session: 14 * 24 * 3600, // 14d
      Interaction: 1800,
      Grant: 30 * 24 * 3600,
    },
    renderError: async (ctx: any, out: any) => {
      ctx.type = 'json';
      ctx.body = {
        error: out.error,
        error_description: out.error_description,
      };
    },
  };

  return new Provider(config.issuer, configuration);
}
