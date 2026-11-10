import 'dotenv/config';
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import { closeDataSource, getDataSource, waitReady } from '../dist/db/data-source.js';
import { encryptSecret } from '../dist/common/secret-cipher.js';

/**
 * 种子脚本：注册一个演示用公共客户端（PKCE + token_endpoint_auth_method=none），
 * 用于冒烟测试完整授权码流程。
 * 依赖 dist 产物（实体/迁移），先执行 npm run build。
 * 用法: npm run seed
 */
const DEMO_CLIENT = {
  client_id: 'wb-demo-spa',
  client_name: '演示应用（SPA + PKCE）',
  application_type: 'spa',
  token_endpoint_auth_method: 'none',
  redirect_uris: [
    'http://localhost:3000/callback',
    'http://localhost:5173/callback',
  ],
  post_logout_redirect_uris: [],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  scope: 'openid profile email',
};

async function main() {
  await waitReady(); // 等 DataSource 初始化并跑完迁移，避免 relation does not exist
  const ds = getDataSource();

  const clients = ds.getRepository('OidcClient');
  const existing = await clients.findOne({ where: { clientId: DEMO_CLIENT.client_id } });
  if (existing) {
    await clients.update(
      { clientId: DEMO_CLIENT.client_id },
      {
        clientName: DEMO_CLIENT.client_name,
        redirectUris: DEMO_CLIENT.redirect_uris,
      },
    );
  } else {
    await clients.insert({
      clientId: DEMO_CLIENT.client_id,
      clientSecret: encryptSecret('not-used-for-public-client'),
      clientName: DEMO_CLIENT.client_name,
      applicationType: DEMO_CLIENT.application_type,
      tokenEndpointAuthMethod: DEMO_CLIENT.token_endpoint_auth_method,
      redirectUris: DEMO_CLIENT.redirect_uris,
      postLogoutRedirectUris: DEMO_CLIENT.post_logout_redirect_uris,
      grantTypes: DEMO_CLIENT.grant_types,
      responseTypes: DEMO_CLIENT.response_types,
      scope: DEMO_CLIENT.scope,
    });
  }
  console.log(`[seed] demo client ready: ${DEMO_CLIENT.client_id}`);

  // 首次运行创建超级管理员（已有管理员则跳过，不会覆盖密码）
  const admins = ds.getRepository('OidcAdmin');
  const count = await admins.count();
  if (count === 0) {
    const username = (process.env.ADMIN_INIT_USERNAME || 'admin').trim();
    const password = process.env.ADMIN_INIT_PASSWORD || randomBytes(9).toString('base64url');
    await admins.insert({
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      displayName: '超级管理员',
      role: 'super_admin',
    });
    console.log(`[seed] 已创建超级管理员: ${username}`);
    console.log('[seed] 凭据已写入: backend/.admin-credentials.txt（请查看后删除该文件）');
    writeFileSync(
      '.admin-credentials.txt',
      `用户名: ${username}\n密码: ${password}\n生成时间: ${new Date().toISOString()}\n登录后请尽快在控制台修改密码。\n`,
      'utf8',
    );
  } else {
    console.log(`[seed] 管理员已存在（${count} 个），跳过创建`);
  }

  await closeDataSource();
}

main().catch((err) => {
  console.error('[seed] 失败:', err.message);
  process.exit(1);
});
