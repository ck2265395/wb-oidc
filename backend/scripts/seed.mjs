import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getPool, closePool, waitReady } from '../dist/db/pool.js';

/**
 * 种子脚本：注册一个演示用公共客户端（PKCE + token_endpoint_auth_method=none），
 * 用于冒烟测试完整授权码流程。
 * 用法: npm run seed
 */
const DEMO_CLIENT = {
  client_id: 'wb-demo-spa',
  client_name: '演示应用（SPA + PKCE）',
  application_type: 'spa',
  token_endpoint_auth_method: 'none',
  redirect_uris: JSON.stringify([
    'http://localhost:3000/callback',
    'http://localhost:5173/callback',
  ]),
  post_logout_redirect_uris: JSON.stringify([]),
  grant_types: JSON.stringify(['authorization_code', 'refresh_token']),
  response_types: JSON.stringify(['code']),
  scope: 'openid profile email',
};

async function main() {
  await waitReady(); // 等 ensureSchema 建完表，避免 relation does not exist
  const pool = getPool();
  await pool.query(
    `INSERT INTO oidc_clients
      (client_id, client_secret, client_name, application_type,
       token_endpoint_auth_method, redirect_uris, post_logout_redirect_uris,
       grant_types, response_types, scope)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10)
     ON CONFLICT (client_id) DO UPDATE SET
       redirect_uris = EXCLUDED.redirect_uris,
       client_name = EXCLUDED.client_name,
       updated_at = NOW()`,
    [
      DEMO_CLIENT.client_id,
      'not-used-for-public-client',
      DEMO_CLIENT.client_name,
      DEMO_CLIENT.application_type,
      DEMO_CLIENT.token_endpoint_auth_method,
      DEMO_CLIENT.redirect_uris,
      DEMO_CLIENT.post_logout_redirect_uris,
      DEMO_CLIENT.grant_types,
      DEMO_CLIENT.response_types,
      DEMO_CLIENT.scope,
    ],
  );
  console.log(`[seed] demo client ready: ${DEMO_CLIENT.client_id}`);

  // 首次运行创建超级管理员（已有管理员则跳过，不会覆盖密码）
  const { rows: admins } = await pool.query('SELECT COUNT(*)::int AS n FROM oidc_admin');
  if (admins[0].n === 0) {
    const username = (process.env.ADMIN_INIT_USERNAME || 'admin').trim();
    const password = process.env.ADMIN_INIT_PASSWORD || randomBytes(9).toString('base64url');
    const hash = bcrypt.hashSync(password, 10);
    await pool.query(
      `INSERT INTO oidc_admin (username, password_hash, display_name, role)
       VALUES ($1,$2,$3,'super_admin')`,
      [username, hash, '超级管理员'],
    );
    console.log('[seed] 已创建超级管理员（请立即保存并改密）:');
    console.log(`        用户名: ${username}`);
    console.log(`        密码:   ${password}`);
  } else {
    console.log(`[seed] 管理员已存在（${admins[0].n} 个），跳过创建`);
  }

  await closePool();
}

main().catch((err) => {
  console.error('[seed] 失败:', err.message);
  process.exit(1);
});
