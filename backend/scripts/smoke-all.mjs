/**
 * 全链路冒烟测试（M1–M6）：
 * 管理端鉴权 → 开发者注册/审核 → 应用申请/审核 → OIDC 授权闸门 →
 * 改回调回退待审 → 越权隔离 → 审计/概览/会话/老库用户接口 → 清理测试数据。
 *
 * 用法：node scripts/smoke-all.mjs [baseUrl]
 * 默认 http://localhost:3200，且服务必须指向测试库。
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = resolve(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:3200';

// 读取 backend/.env
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
const ADMIN_USER = `smoke_admin_${suffix}`;
const ADMIN_PASS = 'SmokeAdmin1234';
const DEV_EMAIL = `smoke_dev_${suffix}@example.com`;
const DEV2_EMAIL = `smoke_dev2_${suffix}@example.com`;
const DEV_PASS = 'SmokeDev12345';
const REDIRECT = 'https://dev.example.com/cb';
const REDIRECT_NEW = 'https://dev.example.com/cb2';

let passed = 0;
let failed = 0;
const results = [];

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    results.push(`  ✅ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: raw ? 'manual' : 'follow',
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  console.log(`\n===== 全链路冒烟测试 @ ${BASE} =====\n`);

  // 0. 健康检查
  const health = await req('GET', '/api/health');
  check('健康检查 /api/health', health.status === 200 && health.data?.status === 'ok');

  // 0.1 前端路由可访问
  const feLogin = await req('GET', '/developer/login');
  check(
    '开发者门户页面可访问',
    feLogin.status === 200 && String(feLogin.data).includes('<div id="app">'),
  );

  // 准备：临时超管（直接写库，测完删除）
  const hash = bcrypt.hashSync(ADMIN_PASS, 10);
  await pool.query(
    `INSERT INTO oidc_admin (username, password_hash, display_name, role, enabled)
     VALUES ($1,$2,'冒烟测试超管','super_admin',TRUE)`,
    [ADMIN_USER, hash],
  );

  // 1. 管理员登录
  const adminLogin = await req('POST', '/api/admin/auth/login', {
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  const adminToken = adminLogin.data?.access_token;
  check('管理员登录', adminLogin.status === 200 && !!adminToken);

  // 2. 未带 token 访问管理接口
  const noToken = await req('GET', '/api/admin/clients');
  check('管理接口无 token 拒绝（401）', noToken.status === 401);

  // 3. 开发者注册
  const devReg = await req('POST', '/api/developer/auth/register', {
    body: { email: DEV_EMAIL, password: DEV_PASS, company: '冒烟测试公司', contact: '13800000000' },
  });
  check('开发者注册', devReg.status === 200 && devReg.data?.ok === true);

  // 3.1 重复注册
  const devDup = await req('POST', '/api/developer/auth/register', {
    body: { email: DEV_EMAIL, password: DEV_PASS },
  });
  check('重复邮箱注册被拒（409/400）', devDup.status === 409 || devDup.status === 400, `status=${devDup.status}`);

  // 4. 待审核状态不能登录
  const devLoginPending = await req('POST', '/api/developer/auth/login', {
    body: { email: DEV_EMAIL, password: DEV_PASS },
  });
  check('开发者待审核登录被拒（403）', devLoginPending.status === 403);

  // 5. 管理员查看待审核开发者
  const devList = await req('GET', '/api/admin/developers?status=pending', { token: adminToken });
  const devRow = devList.data?.data?.find((d) => d.email === DEV_EMAIL);
  check('管理端可见待审核开发者', devList.status === 200 && !!devRow);

  // 6. 管理员审核通过
  const devApprove = await req('PATCH', `/api/admin/developers/${devRow?.id}/status`, {
    token: adminToken,
    body: { status: 'active' },
  });
  check('管理员审核开发者通过', devApprove.status === 200 && devApprove.data?.data?.status === 'active');

  // 7. 审核通过后登录
  const devLogin = await req('POST', '/api/developer/auth/login', {
    body: { email: DEV_EMAIL, password: DEV_PASS },
  });
  const devToken = devLogin.data?.access_token;
  check('开发者登录成功', devLogin.status === 200 && !!devToken);
  check('开发者状态为 active', devLogin.data?.developer?.status === 'active');

  const devMe = await req('GET', '/api/developer/auth/me', { token: devToken });
  check('开发者 /me', devMe.status === 200 && devMe.data?.data?.email === DEV_EMAIL);

  // 8. 提交应用申请
  const appCreate = await req('POST', '/api/developer/apps', {
    token: devToken,
    body: {
      client_name: '冒烟测试应用',
      redirect_uris: [REDIRECT],
      application_type: 'web',
      scope: 'openid profile email',
    },
  });
  const clientId = appCreate.data?.client_id;
  check(
    '开发者创建应用（pending）',
    (appCreate.status === 200 || appCreate.status === 201) &&
      appCreate.data?.data?.status === 'pending' &&
      !!clientId,
  );
  check('创建时返回 client_secret', !!appCreate.data?.client_secret);

  // 9. pending 应用发起授权 → 被拒
  const authPending = await req(
    'GET',
    `/auth?client_id=${clientId}&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(REDIRECT)}&state=s1`,
    { raw: true },
  );
  check('pending 应用授权被拒（400）', authPending.status === 400);

  // 10. 管理端列表带申请人邮箱与状态
  const adminClients = await req('GET', '/api/admin/clients', { token: adminToken });
  const clientRow = adminClients.data?.data?.find((c) => c.client_id === clientId);
  check(
    '管理端应用列表含申请人与 pending 状态',
    adminClients.status === 200 && clientRow?.developer_email === DEV_EMAIL && clientRow?.status === 'pending',
  );

  // 11. 管理员审核通过应用
  const appApprove = await req('POST', `/api/admin/clients/${clientId}/review`, {
    token: adminToken,
    body: { action: 'approve' },
  });
  check('管理员审核应用通过', appApprove.status === 201 || appApprove.status === 200);
  check('应用状态 = approved', appApprove.data?.data?.status === 'approved');

  // 12. 审核通过后授权正常（303 跳 interaction）
  const authOk = await req(
    'GET',
    `/auth?client_id=${clientId}&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(REDIRECT)}&state=s1`,
    { raw: true },
  );
  check('approved 应用授权通过（303）', authOk.status === 303, `Location: ${authOk.headers.get('location') || '-'}`);

  // 13. 开发者改回调 → 回退 pending
  const devEdit = await req('PATCH', `/api/developer/apps/${clientId}`, {
    token: devToken,
    body: { redirect_uris: [REDIRECT_NEW] },
  });
  check('开发者修改回调成功', devEdit.status === 200);
  check('改回调后回退 pending', devEdit.data?.data?.status === 'pending');

  // 14. 再审核通过（恢复状态，便于后续清理判断）
  const appApprove2 = await req('POST', `/api/admin/clients/${clientId}/review`, {
    token: adminToken,
    body: { action: 'approve' },
  });
  check('二次审核通过', appApprove2.data?.data?.status === 'approved');

  // 15. 越权隔离：第二个开发者访问别人的应用 → 404
  const dev2Hash = bcrypt.hashSync(DEV_PASS, 10);
  await pool.query(
    `INSERT INTO oidc_developer (email, password_hash, company, contact, status)
     VALUES ($1,$2,'越权测试公司','-','active')`,
    [DEV2_EMAIL, dev2Hash],
  );
  const dev2Login = await req('POST', '/api/developer/auth/login', {
    body: { email: DEV2_EMAIL, password: DEV_PASS },
  });
  const dev2Token = dev2Login.data?.access_token;
  const crossEdit = await req('PATCH', `/api/developer/apps/${clientId}`, {
    token: dev2Token,
    body: { redirect_uris: ['https://evil.example.com/cb'] },
  });
  check('跨开发者改应用被拒（404）', crossEdit.status === 404);

  // 15.1 开发者应用列表只看到自己的
  const dev2Apps = await req('GET', '/api/developer/apps', { token: dev2Token });
  check(
    '开发者应用列表隔离',
    dev2Apps.status === 200 && (dev2Apps.data?.data || []).every((a) => a.client_id !== clientId),
  );

  // 16. 开发者 token 访问管理接口 → 401
  const crossAdmin = await req('GET', '/api/admin/clients', { token: devToken });
  check('开发者 token 访问管理接口被拒（401）', crossAdmin.status === 401);

  // 17. 审计日志
  const logs = await req('GET', '/api/admin/logs?size=5', { token: adminToken });
  check('审计日志接口', logs.status === 200 && Array.isArray(logs.data?.data));
  check('审计日志有记录', Number(logs.data?.total) > 0, `total=${logs.data?.total}`);
  const logFilter = await req('GET', '/api/admin/logs?action=client.review', { token: adminToken });
  check('审计日志按动作筛选', logFilter.status === 200);

  // 18. 概览统计
  const overview = await req('GET', '/api/admin/overview', { token: adminToken });
  check(
    '概览统计接口',
    overview.status === 200 &&
      overview.data?.data?.clients !== undefined &&
      overview.data?.data?.developers !== undefined,
    `clients=${overview.data?.data?.clients?.total} developers=${overview.data?.data?.developers?.total}`,
  );
  check('概览含最近操作', Array.isArray(overview.data?.data?.recent_logs));

  // 19. 会话管理
  const sessions = await req('GET', '/api/admin/sessions', { token: adminToken });
  check('会话列表接口', sessions.status === 200 && Array.isArray(sessions.data?.data));
  const revokeMissing = await req('DELETE', '/api/admin/sessions/not-exist-uid', { token: adminToken });
  check('吊销不存在会话返回 400', revokeMissing.status === 400);

  // 20. 老库用户查询
  const legacyList = await req('GET', '/api/admin/legacy-users?size=3', { token: adminToken });
  check(
    '老库用户查询接口',
    legacyList.status === 200 && Array.isArray(legacyList.data?.data),
    `total=${legacyList.data?.total}`,
  );
  if (legacyList.status === 200 && legacyList.data?.data?.length) {
    const row = legacyList.data.data[0];
    check('老库密码字段已脱敏', row.password === '******' || !('password' in row));
  }
  const legacySearch = await req('GET', '/api/admin/legacy-users?keyword=zzzz-not-exist', {
    token: adminToken,
  });
  check('老库关键词查询（空结果）', legacySearch.status === 200 && Number(legacySearch.data?.total) === 0);

  // 21. 管理端刷新续期
  const refreshRes = await fetch(`${BASE}/api/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  check('无 cookie 刷新被拒（401）', refreshRes.status === 401);

  // ===== 清理 =====
  await pool.query('DELETE FROM oidc_clients WHERE client_id = $1', [clientId]);
  await pool.query('DELETE FROM oidc_developer WHERE email IN ($1,$2)', [DEV_EMAIL, DEV2_EMAIL]);
  await pool.query('DELETE FROM oidc_admin WHERE username = $1', [ADMIN_USER]);

  const leftover = await pool.query(
    'SELECT (SELECT COUNT(*) FROM oidc_developer WHERE email LIKE $1) AS dev, (SELECT COUNT(*) FROM oidc_admin WHERE username = $2) AS adm, (SELECT COUNT(*) FROM oidc_clients WHERE client_id = $3) AS cli',
    [`smoke_dev_%@example.com`, ADMIN_USER, clientId],
  );
  const l = leftover.rows[0];
  check('测试数据已清理', Number(l.dev) === 0 && Number(l.adm) === 0 && Number(l.cli) === 0);

  console.log(results.join('\n'));
  console.log(`\n===== 结果：${passed} 项通过，${failed} 项失败 =====\n`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error('\n[smoke] 执行异常：', err);
  try {
    // 按本次测试的固定前缀清理，绝不触碰其他数据
    await pool.query(`DELETE FROM oidc_developer WHERE email LIKE $1`, ['smoke_dev%example.com']);
    await pool.query('DELETE FROM oidc_admin WHERE username LIKE $1', ['smoke_admin_%']);
  } catch {
    /* ignore */
  }
  await pool.end();
  process.exit(1);
});
