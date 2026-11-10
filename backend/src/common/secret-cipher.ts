import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 应用密钥（OIDC client_secret）的落库加密。
 *
 * 设计取舍：
 * - 用 AES-256-GCM 可逆加密，而不是哈希。因为平台允许开发者随时查看自己的密钥，
 *   哈希存了就查不出来。代价是主密钥必须与数据库分开保管，否则加密失去意义。
 * - 主密钥优先级：环境变量 CLIENT_SECRET_KEY（推荐生产用）> backend/.secret-key 文件（自动生成）。
 *   两者都没有且文件写不了时降级为进程内存密钥，并在日志里明确告警——那种情况下重启即无法解密。
 * - 存储格式 enc:v1:<iv>:<tag>:<cipher>，带版本前缀便于以后换算法。
 *   不带前缀的值视为历史明文，decrypt 时原样返回，保证旧数据仍可用。
 */

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_FILE = resolve(__dirname, '../../.secret-key');

let cachedKey: Buffer | null = null;
/** 主密钥是否可持久复用（env 或文件）。false 表示仅内存，重启会解不开。 */
let keyPersistent = false;

function loadKey(): Buffer {
  const fromEnv = process.env.CLIENT_SECRET_KEY?.trim();
  if (fromEnv) {
    const buf = /^[0-9a-fA-F]{64}$/.test(fromEnv)
      ? Buffer.from(fromEnv, 'hex')
      : Buffer.from(fromEnv, 'base64');
    if (buf.length !== 32) {
      throw new Error('CLIENT_SECRET_KEY 必须是 32 字节（64 位 hex 或 base64 编码）');
    }
    keyPersistent = true;
    return buf;
  }

  try {
    if (existsSync(KEY_FILE)) {
      const raw = readFileSync(KEY_FILE, 'utf8').trim();
      const buf = Buffer.from(raw, 'hex');
      if (buf.length === 32) {
        keyPersistent = true;
        return buf;
      }
      throw new Error('.secret-key 内容不是 32 字节 hex');
    }
    const buf = randomBytes(32);
    writeFileSync(KEY_FILE, buf.toString('hex'), { mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log('[secret-cipher] 已生成主密钥文件 .secret-key（请与数据库分开备份）');
    keyPersistent = true;
    return buf;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[secret-cipher] 主密钥无法持久化，将使用进程内存密钥：${(err as Error).message}\n` +
        '  → 服务重启后已加密的 client_secret 将无法解密！生产环境请设置 CLIENT_SECRET_KEY。',
    );
    keyPersistent = false;
    return randomBytes(32);
  }
}

function getKey(): Buffer {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(PREFIX);
}

/** 加密明文密钥，返回可直接入库的字符串。空值原样返回（移动/小程序类目没有 secret）。 */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return plain as string;
  if (isEncryptedSecret(plain)) return plain;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

/**
 * 解密入库值。历史明文（无前缀）原样返回，保证改动前创建的应用仍能正常走 OIDC。
 * 主密钥不匹配（换过密钥/丢了密钥文件）时抛错，由调用方决定如何处理。
 */
export function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return stored as string;
  if (!isEncryptedSecret(stored)) return stored;
  const body = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('client_secret 密文格式损坏');
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** 主密钥是否已持久化（启动迁移前用它判断能不能安全加密存量数据） */
export function isKeyPersistent(): boolean {
  getKey();
  return keyPersistent;
}
