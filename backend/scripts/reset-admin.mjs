/**
 * 重置管理员密码：随机生成强密码，写入 backend/.admin-credentials.txt（已被 gitignore 忽略）。
 * 明文不会打印到控制台/日志，避免进入聊天记录和终端历史。
 *
 * 用法：node scripts/reset-admin.mjs <用户名>
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import { getPool, closePool, waitReady } from '../dist/db/pool.js';

const username = (process.argv[2] || 'admin').trim();

async function main() {
  await waitReady();
  const pool = getPool();
  const { rows } = await pool.query('SELECT id FROM oidc_admin WHERE username = $1', [username]);
  if (!rows.length) {
    console.error(`[reset] 管理员不存在: ${username}`);
    process.exit(1);
  }
  const password = randomBytes(12).toString('base64url');
  const hash = bcrypt.hashSync(password, 10);
  await pool.query(
    'UPDATE oidc_admin SET password_hash = $2, enabled = TRUE, updated_at = NOW() WHERE id = $1',
    [rows[0].id, hash],
  );
  // 吊销该账号所有刷新令牌，强制重新登录
  await pool.query(
    'UPDATE oidc_admin_session SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
    [rows[0].id],
  );
  const file = '.admin-credentials.txt';
  writeFileSync(
    file,
    `用户名: ${username}\n密码: ${password}\n生成时间: ${new Date().toISOString()}\n登录后请尽快在控制台修改密码。\n`,
    'utf8',
  );
  console.log(`[reset] 已重置 ${username} 的密码`);
  console.log(`[reset] 凭据已写入: backend/${file}（请查看后删除该文件）`);
  await closePool();
}

main().catch((err) => {
  console.error('[reset] 失败:', err.message);
  process.exit(1);
});
