/**
 * 自助改密码链路冒烟测试（不改变最终密码）：
 *   1. 读 backend/.admin-credentials.txt 拿当前密码
 *   2. 登录 → 改密码 → 旧密码应失效 → 新密码应可登录
 *   3. 用 SQL 恢复原 password_hash 并吊销会话，保持用户密码不变
 *
 * 用法：node scripts/smoke-change-password.mjs [baseUrl]
 * 前提：服务已启动（默认 http://127.0.0.1:3100）
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import { getPool, closePool, waitReady } from '../dist/db/pool.js';

const BASE = (process.argv[2] || 'http://127.0.0.1:3100').replace(/\/$/, '');
const CRED_FILE = '.admin-credentials.txt';

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name} ${extra}`);
  }
}

function readCredentials() {
  const txt = readFileSync(CRED_FILE, 'utf8');
  const username = (txt.match(/用户名:\s*(\S+)/) || [])[1];
  const password = (txt.match(/密码:\s*(\S+)/) || [])[1];
  if (!username || !password) throw new Error(`无法解析 ${CRED_FILE}`);
  return { username, password };
}

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 无 body */
  }
  return { status: res.status, data };
}

async function main() {
  await waitReady();
  const pool = getPool();
  const { username, password: oldPassword } = readCredentials();

  const { rows } = await pool.query(
    'SELECT id, password_hash FROM oidc_admin WHERE username = $1',
    [username],
  );
  if (!rows.length) throw new Error(`管理员不存在: ${username}`);
  const { id, password_hash: originalHash } = rows[0];

  const newPassword = `Smoke${Date.now().toString(36)}A1`;

  console.log(`[smoke] 目标 ${BASE}，账号 ${username}`);

  // 1. 原密码登录
  const login1 = await post('/api/admin/auth/login', { username, password: oldPassword });
  check('原密码登录 200', login1.status === 200, `got ${login1.status}`);
  const token = login1.data?.access_token;

  // 2. 弱密码应被拒
  const weak = await post(
    '/api/admin/auth/change-password',
    { old_password: oldPassword, new_password: '123456' },
    token,
  );
  check('弱密码被拒 400', weak.status === 400, `got ${weak.status}`);

  // 3. 原密码错误应被拒
  const wrongOld = await post(
    '/api/admin/auth/change-password',
    { old_password: 'definitely-wrong', new_password: newPassword },
    token,
  );
  check('原密码错误被拒 400', wrongOld.status === 400, `got ${wrongOld.status}`);

  // 4. 未登录调用应 401
  const noAuth = await post('/api/admin/auth/change-password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
  check('未登录被拒 401', noAuth.status === 401, `got ${noAuth.status}`);

  // 5. 正常修改
  const ok = await post(
    '/api/admin/auth/change-password',
    { old_password: oldPassword, new_password: newPassword },
    token,
  );
  check('修改密码 200', ok.status === 200, `got ${ok.status} ${JSON.stringify(ok.data)}`);

  // 6. 旧密码应失效
  const loginOld = await post('/api/admin/auth/login', { username, password: oldPassword });
  check('旧密码登录 401', loginOld.status === 401, `got ${loginOld.status}`);

  // 7. 新密码可登录
  const loginNew = await post('/api/admin/auth/login', { username, password: newPassword });
  check('新密码登录 200', loginNew.status === 200, `got ${loginNew.status}`);
  const newToken = loginNew.data?.access_token;

  // 8. 新 token 可访问 /me
  const me = await fetch(BASE + '/api/admin/auth/me', {
    headers: { authorization: `Bearer ${newToken}` },
  });
  check('新会话访问 me 200', me.status === 200, `got ${me.status}`);

  // 恢复原密码哈希 + 吊销测试期间产生的会话
  await pool.query(
    'UPDATE oidc_admin SET password_hash = $2, updated_at = NOW() WHERE id = $1',
    [id, originalHash],
  );
  await pool.query(
    'UPDATE oidc_admin_session SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
    [id],
  );

  // 9. 原密码恢复后可登录
  const loginRestored = await post('/api/admin/auth/login', { username, password: oldPassword });
  check('原密码已恢复，可登录 200', loginRestored.status === 200, `got ${loginRestored.status}`);

  console.log(`\n[smoke] 结果：${pass} PASS / ${fail} FAIL`);
  await closePool();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('[smoke] 异常:', err.message);
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
