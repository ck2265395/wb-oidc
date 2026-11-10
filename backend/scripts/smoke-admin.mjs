/**
 * 管理端登录链路冒烟测试：
 * 建临时管理员 → 登录 → 无 token 401 → 带 token 200 → refresh → me → 错误密码 401 → 清理。
 * 只输出 PASS/FAIL，不打印任何口令或令牌。
 *
 * 前置：服务已启动（默认 http://127.0.0.1:3100），且 .env 已配好 PG。
 * 用法：node scripts/smoke-admin.mjs [baseUrl]
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { closeDataSource, getDataSource, waitReady } from '../dist/db/data-source.js';

const BASE = (process.argv[2] || 'http://127.0.0.1:3100').replace(/\/$/, '');
const username = `smoke_${randomBytes(4).toString('hex')}`;
const password = randomBytes(12).toString('base64url');

let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failures++;
}

function pickCookie(res) {
  const list = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') || ''];
  const raw = list.find((c) => c.includes('wb_oidc_admin_rt='));
  return raw ? raw.split(';')[0] : '';
}

async function main() {
  await waitReady();
  const ds = getDataSource();
  const rows = await ds.query(
    `INSERT INTO oidc_admin (username, password_hash, display_name, role)
     VALUES ($1,$2,'smoke test','super_admin') RETURNING id`,
    [username, bcrypt.hashSync(password, 10)],
  );
  const adminId = rows[0].id;

  try {
    // 1. 错误密码
    const bad = await fetch(`${BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password: 'definitely-wrong' }),
    });
    check('错误密码返回 401', bad.status === 401, `got ${bad.status}`);

    // 2. 正确登录
    const login = await fetch(`${BASE}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const loginBody = await login.json().catch(() => ({}));
    const accessToken = loginBody.access_token;
    const cookie = pickCookie(login);
    check('登录返回 200 + access_token', login.status === 200 && !!accessToken, `got ${login.status}`);
    check('登录下发 httpOnly 刷新 cookie', cookie.startsWith('wb_oidc_admin_rt='));

    // 3. 无 token 访问受保护接口
    const anon = await fetch(`${BASE}/api/admin/clients`);
    check('无 token 访问管理接口返回 401', anon.status === 401, `got ${anon.status}`);

    // 4. 带 token 访问
    const authed = await fetch(`${BASE}/api/admin/clients`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    check('带 token 访问管理接口返回 200', authed.status === 200, `got ${authed.status}`);

    // 5. 伪造 token
    const forged = await fetch(`${BASE}/api/admin/clients`, {
      headers: { authorization: 'Bearer not-a-real-token' },
    });
    check('伪造 token 返回 401', forged.status === 401, `got ${forged.status}`);

    // 6. 刷新令牌（轮换）
    const refresh = await fetch(`${BASE}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    });
    const refreshBody = await refresh.json().catch(() => ({}));
    check(
      'refresh 返回新 access_token',
      refresh.status === 200 && !!refreshBody.access_token,
      `got ${refresh.status}`,
    );

    // 7. 当前管理员信息
    const me = await fetch(`${BASE}/api/admin/auth/me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const meBody = await me.json().catch(() => ({}));
    check(
      'me 返回当前管理员且不含 password_hash',
      me.status === 200 && meBody?.data?.username === username && !('password_hash' in (meBody?.data || {})),
      `got ${me.status}`,
    );

    // 8. 管理员列表（super_admin 可用）
    const users = await fetch(`${BASE}/api/admin/users`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    check('super_admin 可列出管理员', users.status === 200, `got ${users.status}`);

    // 9. 登出后刷新令牌失效
    await fetch(`${BASE}/api/admin/auth/logout`, { method: 'POST', headers: { cookie } });
    const afterLogout = await fetch(`${BASE}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { cookie },
    });
    check('登出后 refresh 失效返回 401', afterLogout.status === 401, `got ${afterLogout.status}`);
  } finally {
    await ds.query('DELETE FROM oidc_admin WHERE id = $1', [adminId]);
    await closeDataSource();
  }

  console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[smoke] 异常:', err.message);
  process.exit(1);
});
