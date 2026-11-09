/**
 * 老库密码算法校验工具：用你手上的测试账号验证 OIDC 该配哪种哈希算法。
 *
 * 用法：
 *   node scripts/verify-legacy.mjs <username> <password>
 *
 * 它会：
 *   1. 连老库取出该用户的 password 字段
 *   2. 依次用常见算法（SHA256/HMAC-SHA256 base64、MD5/SHA1/SHA256 hex、bcrypt）计算并比对
 *   3. 打印匹配的算法，以及应该写进 .env 的 LEGACY_PASSWORD_HASH / LEGACY_HMAC_KEY
 */
import 'dotenv/config';
import { Client } from 'pg';
import * as crypto from 'crypto';
import * as bcryptjs from 'bcryptjs';

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error('用法: node scripts/verify-legacy.mjs <username> <password>');
  process.exit(1);
}

const cfg = {
  host: process.env.LEGACY_DB_HOST || 'localhost',
  port: Number(process.env.LEGACY_DB_PORT || 5432),
  user: process.env.LEGACY_DB_USER || 'postgres',
  password: process.env.LEGACY_DB_PASSWORD || '',
  database: process.env.LEGACY_DB_NAME || '',
};
const table = process.env.LEGACY_USER_TABLE || 'USER';
const usernameField = process.env.LEGACY_USERNAME_FIELD || 'username';
const passwordField = process.env.LEGACY_PASSWORD_FIELD || 'password';
const idField = process.env.LEGACY_ID_FIELD || 'id';

const hex = (alg, s) => crypto.createHash(alg).update(s).digest('hex');
const b64 = (alg, s) => crypto.createHash(alg).update(s).digest('base64');
const hmacB64 = (key, s) => crypto.createHmac('sha256', key).update(s).digest('base64');

async function main() {
  const client = new Client(cfg);
  await client.connect();
  const { rows } = await client.query(
    `SELECT "${idField}" AS id, "${passwordField}" AS pwd, LENGTH("${passwordField}") AS len
       FROM "${table}" WHERE "${usernameField}" = $1 LIMIT 5`,
    [username],
  );
  await client.end();

  if (!rows.length) {
    console.log(`[verify] 老库中找不到用户: ${username}（表 ${table}）`);
    process.exit(2);
  }
  console.log(`[verify] 命中 ${rows.length} 条记录，取第一条 id=${rows[0].id}，哈希长度 ${rows[0].len}`);

  const stored = rows[0].pwd;
  if (typeof stored !== 'string') {
    console.log('[verify] password 字段不是字符串，实际类型:', typeof stored);
    process.exit(2);
  }
  console.log('[verify] 存储值前 16 位:', stored.slice(0, 16) + '...');

  const candidates = [
    ['hmac-sha256-b64 (key=moondropapp&&)', hmacB64('moondropapp&&', password), 'hmac-sha256-b64', 'moondropapp&&'],
    ['hmac-sha256-b64 (key=LEGACY_HMAC_KEY)', hmacB64(process.env.LEGACY_HMAC_KEY || '', password), 'hmac-sha256-b64', process.env.LEGACY_HMAC_KEY || ''],
    ['sha256-base64', b64('sha256', password), 'sha256-b64', ''],
    ['sha256-hex', hex('sha256', password), 'sha256', ''],
    ['sha1-hex', hex('sha1', password), 'sha1', ''],
    ['md5-hex', hex('md5', password), 'md5', ''],
    ['md5-base64', b64('md5', password), 'md5-b64', ''],
  ];

  let matched = false;
  for (const [label, computed, algorithm, key] of candidates) {
    const ok = computed === stored || computed.toLowerCase() === stored.toLowerCase();
    if (ok) {
      matched = true;
      console.log(`\n✅ 匹配: ${label}`);
      console.log('   .env 配置:');
      console.log(`   LEGACY_PASSWORD_HASH=${algorithm}`);
      if (key) console.log(`   LEGACY_HMAC_KEY=${key}`);
    }
  }

  if (!matched) {
    // bcrypt 单独处理（自带盐，hash 以 $2 开头）
    if (stored.startsWith('$2') && bcryptjs.compareSync(password, stored)) {
      console.log('\n✅ 匹配: bcrypt');
      console.log('   LEGACY_PASSWORD_HASH=bcrypt');
      return;
    }
    console.log('\n❌ 没有匹配到常见算法。');
    console.log('   可能原因：密码输错 / 老库用了自定义盐 / 算法是 SHA-256(salt+password) 之类。');
    console.log('   把这条记录发我（不用给真实密码），或者告诉我老系统登录的加密代码位置，我来适配。');
    process.exit(3);
  }
}

main().catch((err) => {
  console.error('[verify] 失败:', err.message);
  process.exit(1);
});
