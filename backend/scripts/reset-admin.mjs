/**
 * 重置管理员密码：随机生成强密码，写入 backend/.admin-credentials.txt（已被 gitignore 忽略）。
 * 明文不会打印到控制台/日志，避免进入聊天记录和终端历史。
 *
 * 用法：node scripts/reset-admin.mjs <用户名>
 */
import 'dotenv/config';
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { writeFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import { closeDataSource, getDataSource, waitReady } from '../dist/db/data-source.js';

const username = (process.argv[2] || 'admin').trim();

async function main() {
  await waitReady();
  const ds = getDataSource();
  const admins = ds.getRepository('OidcAdmin');
  const sessions = ds.getRepository('OidcAdminSession');
  const row = await admins.findOne({ where: { username }, select: { id: true, username: true } });
  if (!row) {
    console.error(`[reset] 管理员不存在: ${username}`);
    process.exit(1);
  }
  const password = randomBytes(12).toString('base64url');
  await admins.update(
    { id: row.id },
    { passwordHash: bcrypt.hashSync(password, 10), enabled: true },
  );
  // 吊销该账号所有刷新令牌，强制重新登录
  await sessions.update(
    { adminId: row.id, revokedAt: null },
    { revokedAt: new Date() },
  );
  const file = '.admin-credentials.txt';
  writeFileSync(
    file,
    `用户名: ${username}\n密码: ${password}\n生成时间: ${new Date().toISOString()}\n登录后请尽快在控制台修改密码。\n`,
    'utf8',
  );
  console.log(`[reset] 已重置 ${username} 的密码`);
  console.log(`[reset] 凭据已写入: backend/${file}（请查看后删除该文件）`);
  await closeDataSource();
}

main().catch((err) => {
  console.error('[reset] 失败:', err.message);
  process.exit(1);
});
