import 'dotenv/config';
import 'reflect-metadata';
import { Client } from 'pg';
import { spawn } from 'child_process';

/**
 * 全量初始化数据库：清空所有业务表 → 重新跑迁移建表 → 重新写入种子数据。
 * 危险操作：所有数据（应用/管理员/开发者/协议状态）都会丢失。
 *
 * 用法：npm run db:reinit
 * 护栏：NODE_ENV=production 环境直接拒绝执行（本地/测试环境不受限）。
 */
const TABLES = [
  'oidc_provider_state',
  'oidc_developer_session',
  'oidc_developer',
  'oidc_admin_log',
  'oidc_admin_session',
  'oidc_admin',
  'oidc_clients',
];

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  console.error('[reinit] 已拒绝：NODE_ENV=production 禁止执行 db:reinit（会清空全部业务数据）');
  process.exit(1);
}

async function dropAll() {
  const client = new Client({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || 'wb_oidc',
  });
  await client.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS ${TABLES.join(', ')}, migrations CASCADE`);
    console.log('[reinit] 已清空全部业务表');
  } finally {
    await client.end();
  }
}

async function main() {
  await dropAll();
  // seed.mjs 内部会显式 runMigrations（幂等），再写入演示客户端与首个超管
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/seed.mjs'], { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed 退出码 ${code}`))));
  });
  console.log('[reinit] 完成。管理员凭据见 backend/.admin-credentials.txt');
}

main().catch((err) => {
  console.error('[reinit] 失败:', err.message);
  process.exit(1);
});
