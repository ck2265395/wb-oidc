/**
 * 开发者资料编辑链路冒烟（独立脚本，不改动 smoke-all.mjs）
 *
 * 覆盖：注册即登录 → 仅保存资料（状态不变）→ 提交资格审核 → 审核中改资料
 *      → 资格通过后改资料（不撤销认证）→ 旧 token 仍可创建应用 → 清理。
 *
 * 用法：node scripts/smoke-profile.mjs [baseUrl]
 * 说明：为避免依赖真实管理员密码，审核通过这一步直接用 SQL 模拟管理员操作。
 */
import fs from 'node:fs';
import pg from 'pg';

const BASE = process.argv[2] || 'http://localhost:3200';
const EMAIL = `smoke_profile_${Date.now()}@example.com`;
const PASSWORD = 'SmokeProfile@2026';

let passed = 0;
let failed = 0;
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` | ${extra}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, data };
}

function loadEnv() {
  const env = { ...process.env };
  const file = new URL('../.env', import.meta.url);
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (!(k in env)) env[k] = v;
  }
  return env;
}

const env = loadEnv();
const pool = new pg.Pool({
  host: env.PG_HOST || 'localhost',
  port: Number(env.PG_PORT || 5432),
  user: env.PG_USER,
  password: env.PG_PASSWORD,
  database: env.PG_DATABASE,
});

let devId = null;

async function cleanup() {
  const statements = [];
  if (devId) {
    statements.push(['DELETE FROM oidc_clients WHERE developer_id = $1', [devId]]);
    statements.push(['DELETE FROM oidc_developer_session WHERE developer_id = $1', [devId]]);
    statements.push(['DELETE FROM oidc_developer WHERE id = $1', [devId]]);
  }
  statements.push(['DELETE FROM oidc_developer WHERE email = $1', [EMAIL]]);
  for (const [sql, params] of statements) {
    try {
      await pool.query(sql, params);
    } catch (e) {
      console.log(`  WARN  清理语句失败：${e.message}`);
    }
  }
}

async function main() {
  console.log(`\n[profile-smoke] 目标 ${BASE}\n`);
  const health = await req('GET', '/api/health');
  check('健康检查', health.status === 200, `status=${health.status}`);

  const reg = await req('POST', '/api/developer/auth/register', {
    body: { email: EMAIL, password: PASSWORD },
  });
  check('注册成功', reg.status === 200, `status=${reg.status}`);

  const login = await req('POST', '/api/developer/auth/login', {
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.data?.access_token;
  check('注册后立即登录', login.status === 200 && !!token, `status=${login.status}`);
  check(
    '初始资格 = none',
    login.data?.developer?.developer_status === 'none',
    JSON.stringify(login.data?.developer?.developer_status),
  );

  // 未登录改资料必须被拒
  const noAuth = await req('PATCH', '/api/developer/profile', {
    body: { company: '未授权公司', contact: '13800000000' },
  });
  check('未登录编辑资料被拒（401）', noAuth.status === 401, `status=${noAuth.status}`);

  // 资料校验
  const bad = await req('PATCH', '/api/developer/profile', {
    token,
    body: { company: 'x', contact: '' },
  });
  check('资料不齐全被拒（400）', bad.status === 400, `status=${bad.status}`);

  // 普通用户仅保存资料：不应触发资格审核
  const saved = await req('PATCH', '/api/developer/profile', {
    token,
    body: { company: '资料编辑测试公司', contact: '0755-88886666' },
  });
  check(
    '仅保存资料成功且资格仍为 none',
    saved.status === 200 &&
      saved.data?.data?.company === '资料编辑测试公司' &&
      saved.data?.data?.contact === '0755-88886666' &&
      saved.data?.data?.developer_status === 'none',
    `status=${saved.status} data=${JSON.stringify(saved.data?.data)}`,
  );

  const meAfterSave = await req('GET', '/api/developer/auth/me', { token });
  check(
    '/me 读到已保存的资料',
    meAfterSave.data?.data?.company === '资料编辑测试公司' &&
      meAfterSave.data?.data?.developer_status === 'none',
  );

  // 仅保存资料后，创建应用仍应被拒（资格未变）
  const appBefore = await req('POST', '/api/developer/apps', {
    token,
    body: {
      client_name: '资料冒烟应用',
      redirect_uris: ['http://localhost:3200/callback'],
      application_type: 'spa',
      scope: 'openid profile',
    },
  });
  check('仅保存资料不获得建应用权限（403）', appBefore.status === 403, `status=${appBefore.status}`);

  // 提交资格审核
  const apply = await req('POST', '/api/developer/apply', {
    token,
    body: { company: '资料编辑测试公司', contact: '0755-88886666' },
  });
  check('提交审核 → pending', apply.data?.data?.developer_status === 'pending', `status=${apply.status}`);

  // 审核中改资料：保持 pending
  const editPending = await req('PATCH', '/api/developer/profile', {
    token,
    body: { company: '审核中改过的公司', contact: '13900000000' },
  });
  check(
    '审核中可改资料且状态保持 pending',
    editPending.status === 200 &&
      editPending.data?.data?.company === '审核中改过的公司' &&
      editPending.data?.data?.developer_status === 'pending',
    `status=${editPending.status}`,
  );

  // 用 SQL 模拟管理员审核通过（不依赖管理员密码）
  const idRow = await pool.query('SELECT id FROM oidc_developer WHERE email = $1', [EMAIL]);
  devId = idRow.rows[0]?.id || null;
  check('测试用户已落库', !!devId);
  if (devId) {
    await pool.query(
      "UPDATE oidc_developer SET developer_status = 'approved', developer_reject_reason = '' WHERE id = $1",
      [devId],
    );
  }

  // 已认证用户改资料：不能撤销认证
  const editApproved = await req('PATCH', '/api/developer/profile', {
    token,
    body: { company: '认证后改过的公司', contact: '13700000000' },
  });
  check(
    '已认证用户改资料不影响资格',
    editApproved.status === 200 &&
      editApproved.data?.data?.company === '认证后改过的公司' &&
      editApproved.data?.data?.developer_status === 'approved',
    `status=${editApproved.status}`,
  );

  // 旧 token 仍可创建应用（服务端实时查库）
  const appAfter = await req('POST', '/api/developer/apps', {
    token,
    body: {
      client_name: '资料冒烟应用',
      redirect_uris: ['http://localhost:3200/callback'],
      application_type: 'spa',
      scope: 'openid profile',
    },
  });
  check(
    '改资料后仍可创建应用（200/201）',
    appAfter.status === 200 || appAfter.status === 201,
    `status=${appAfter.status} data=${JSON.stringify(appAfter.data)}`,
  );

  console.log(`\n[profile-smoke] ${passed} PASS / ${failed} FAIL\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('\n[profile-smoke] 执行异常：', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await pool.end();
  });
