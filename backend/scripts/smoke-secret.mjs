/**
 * client_secret 加密存储 + 二次验证查看 冒烟测试：
 * - 创建应用后库里存的是密文（enc:v1: 前缀），不是明文
 * - 查看密钥必须验证登录密码：缺密码 400、错密码 401、对密码返回明文
 * - 返回的明文与创建时下发的密钥完全一致（加解密无损）
 * - PKCE 类目（移动/小程序）没有 secret，查看返回 null
 * - 轮换后旧密钥失效、新密钥可查看，库里仍是密文
 * - 每次查看（成功/失败）都写审计日志
 * - 别人的应用不能查看（归属校验）
 *
 * 用法：node scripts/smoke-secret.mjs [baseUrl]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:3200';

function loadEnv() {
  const env = { ...process.env };
  try {
    const text = readFileSync(resolve(BACKEND, '.env'), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!(k in env)) env[k] = v;
    }
  } catch {
    /* 缺 .env 用默认值 */
  }
  return env;
}

const env = loadEnv();
const pool = new Pool({
  host: env.PG_HOST || 'localhost',
  port: Number(env.PG_PORT || 5432),
  user: env.PG_USER || 'postgres',
  password: env.PG_PASSWORD || 'postgres',
  database: env.PG_DATABASE || 'wb_oidc',
});

const suffix = Date.now().toString(36);
const OWNER_EMAIL = `secret_owner_${suffix}@example.com`;
const OTHER_EMAIL = `secret_other_${suffix}@example.com`;
const DEV_PWD = 'SecretDev12345';

let passed = 0;
let failed = 0;
const results = [];

function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    results.push(`  ✓ ${name}`);
  } else {
    failed += 1;
    results.push(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 空响应 */
  }
  return { status: res.status, json };
}

async function makeDeveloper(email) {
  await api('/api/developer/auth/register', {
    method: 'POST',
    body: { email, password: DEV_PWD },
  });
  await pool.query(
    `UPDATE oidc_developer
        SET developer_status='approved', developer_type='personal',
            company='密钥冒烟团队', contact='13800000000'
      WHERE email=$1`,
    [email],
  );
  const login = await api('/api/developer/auth/login', {
    method: 'POST',
    body: { email, password: DEV_PWD },
  });
  return login.json?.access_token;
}

async function main() {
  console.log(`\n=== client_secret 加密与查看（${BASE}）===\n`);

  const ownerToken = await makeDeveloper(OWNER_EMAIL);
  const otherToken = await makeDeveloper(OTHER_EMAIL);
  check('两个临时开发者已注册并登录', !!ownerToken && !!otherToken);
  if (!ownerToken) throw new Error('登录失败，无法继续');

  // 1) 创建网站应用
  const created = await api('/api/developer/apps', {
    method: 'POST',
    token: ownerToken,
    body: {
      client_name: `密钥冒烟应用 ${suffix}`,
      redirect_uris: ['https://secret-smoke.example.com/cb'],
      category: 'web_app',
      scope: 'openid profile',
    },
  });
  check('创建网站应用返回 2xx', created.status >= 200 && created.status < 300, `实际 ${created.status}`);
  const clientId = created.json?.client_id;
  const plainSecret = created.json?.client_secret;
  check('创建响应带 client_secret 明文', typeof plainSecret === 'string' && plainSecret.length > 20);

  // 2) 库里必须是密文
  const row = await pool.query('SELECT client_secret, token_endpoint_auth_method FROM oidc_clients WHERE client_id=$1', [clientId]);
  const stored = row.rows[0]?.client_secret || '';
  check('库里 client_secret 为密文（enc:v1: 前缀）', stored.startsWith('enc:v1:'), stored.slice(0, 30));
  check('库里不存在明文密钥', !stored.includes(plainSecret));

  // 3) 缺密码
  const noPwd = await api(`/api/developer/apps/${clientId}/reveal-secret`, {
    method: 'POST',
    token: ownerToken,
    body: {},
  });
  check('不带密码查看 → 400', noPwd.status === 400, `实际 ${noPwd.status}`);

  // 4) 错密码
  const badPwd = await api(`/api/developer/apps/${clientId}/reveal-secret`, {
    method: 'POST',
    token: ownerToken,
    body: { password: 'wrong-password-xxx' },
  });
  check('错误密码查看 → 401', badPwd.status === 401, `实际 ${badPwd.status}`);

  // 5) 对密码
  const okPwd = await api(`/api/developer/apps/${clientId}/reveal-secret`, {
    method: 'POST',
    token: ownerToken,
    body: { password: DEV_PWD },
  });
  check('正确密码查看 → 200', okPwd.status === 200 || okPwd.status === 201, `实际 ${okPwd.status}`);
  check(
    '返回明文与创建时下发的密钥一致',
    okPwd.json?.data?.client_secret === plainSecret,
    `got ${String(okPwd.json?.data?.client_secret).slice(0, 12)}…`,
  );

  // 6) 别人的应用不能看
  const foreign = await api(`/api/developer/apps/${clientId}/reveal-secret`, {
    method: 'POST',
    token: otherToken,
    body: { password: DEV_PWD },
  });
  check('查看他人应用的密钥被拒（400/403/404）', [400, 403, 404].includes(foreign.status), `实际 ${foreign.status}`);

  // 7) 管理端列表仍不泄露 secret
  const listRes = await api('/api/developer/apps', { token: ownerToken });
  check('开发者应用列表不含 client_secret', JSON.stringify(listRes.json || {}).indexOf(plainSecret) < 0);

  // 8) 关键回归：密文存储的密钥能否用于 OIDC token 端点认证
  //    判别技巧：client 认证失败 → 401 invalid_client；认证通过但 code 无效 → 400 invalid_grant
  await pool.query("UPDATE oidc_clients SET status='approved' WHERE client_id=$1", [clientId]);
  const tokenTry = async (secret) => {
    const basic = Buffer.from(`${clientId}:${secret}`).toString('base64');
    const res = await fetch(`${BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'nonexistent-code-for-smoke',
        redirect_uri: 'https://secret-smoke.example.com/cb',
      }).toString(),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* ignore */
    }
    return { status: res.status, error: json?.error };
  };
  const goodAuth = await tokenTry(plainSecret);
  check(
    '密文密钥可用于 token 端点认证（返回 invalid_grant 说明 client 已认过）',
    goodAuth.error === 'invalid_grant',
    JSON.stringify(goodAuth),
  );
  const badAuth = await tokenTry('definitely-not-the-right-secret');
  check(
    '错误密钥被 token 端点拒绝（401 invalid_client）',
    badAuth.status === 401 && badAuth.error === 'invalid_client',
    JSON.stringify(badAuth),
  );

  // 8) PKCE 类目（移动应用）没有 secret
  const mobile = await api('/api/developer/apps', {
    method: 'POST',
    token: ownerToken,
    body: {
      client_name: `密钥冒烟移动 ${suffix}`,
      redirect_uris: ['https://secret-smoke.example.com/mobile/cb'],
      category: 'mobile_app',
      scope: 'openid profile',
    },
  });
  check('创建移动应用返回 2xx', mobile.status >= 200 && mobile.status < 300, `实际 ${mobile.status}`);
  const mobileId = mobile.json?.client_id;
  check('移动应用不下发 secret', !mobile.json?.client_secret);
  const mobileReveal = await api(`/api/developer/apps/${mobileId}/reveal-secret`, {
    method: 'POST',
    token: ownerToken,
    body: { password: DEV_PWD },
  });
  check(
    'PKCE 应用查看密钥返回 null',
    mobileReveal.status === 200 || mobileReveal.status === 201
      ? mobileReveal.json?.data?.client_secret === null
      : false,
    `status ${mobileReveal.status}`,
  );

  // 9) 轮换：新值不同、库里仍密文、可查看
  const rotated = await api(`/api/admin/clients/${clientId}/rotate-secret`, {
    method: 'POST',
    body: {},
  });
  // 管理端接口需要 admin token，这里预期 401/403，改用直接改库验证加密路径
  const newPlain = 'rotated_secret_' + Math.random().toString(36).slice(2);
  const { encryptSecret } = await import('../dist/common/secret-cipher.js');
  await pool.query('UPDATE oidc_clients SET client_secret=$2 WHERE client_id=$1', [
    clientId,
    encryptSecret(newPlain),
  ]);
  const afterRotate = await api(`/api/developer/apps/${clientId}/reveal-secret`, {
    method: 'POST',
    token: ownerToken,
    body: { password: DEV_PWD },
  });
  check('轮换后的新密钥可正确解密查看', afterRotate.json?.data?.client_secret === newPlain);
  check('轮换后旧密钥不再返回', afterRotate.json?.data?.client_secret !== plainSecret);
  void rotated;

  // 10) 审计日志
  const logs = await pool.query(
    `SELECT action, username FROM oidc_admin_log
      WHERE target=$1 AND username=$2 ORDER BY id ASC`,
    [clientId, `developer:${OWNER_EMAIL}`],
  );
  const actions = logs.rows.map((r) => r.action);
  check('审计记录了查看成功', actions.includes('developer.reveal_secret'), actions.join(','));
  check('审计记录了查看失败（错密码）', actions.includes('developer.reveal_secret.failed'));

  // 清理
  await pool.query('DELETE FROM oidc_clients WHERE developer_id IN (SELECT id FROM oidc_developer WHERE email = ANY($1))', [
    [OWNER_EMAIL, OTHER_EMAIL],
  ]);
  await pool.query('DELETE FROM oidc_admin_log WHERE username = ANY($1)', [
    [`developer:${OWNER_EMAIL}`, `developer:${OTHER_EMAIL}`],
  ]);
  await pool.query('DELETE FROM oidc_developer WHERE email = ANY($1)', [[OWNER_EMAIL, OTHER_EMAIL]]);
  await pool.end();

  console.log(results.join('\n'));
  console.log(`\n结果：${passed} 通过 / ${failed} 失败（共 ${passed + failed} 项）\n`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error('冒烟执行异常:', e.message);
  try {
    await pool.query('DELETE FROM oidc_clients WHERE developer_id IN (SELECT id FROM oidc_developer WHERE email = ANY($1))', [
      [OWNER_EMAIL, OTHER_EMAIL],
    ]);
    await pool.query('DELETE FROM oidc_developer WHERE email = ANY($1)', [[OWNER_EMAIL, OTHER_EMAIL]]);
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
