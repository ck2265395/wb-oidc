import { getPool } from '../db/pool';
import { encryptSecret, isKeyPersistent } from './secret-cipher';

/**
 * 把库里历史的明文 client_secret 一次性加密。
 *
 * 幂等：只处理不带 enc:v1: 前缀的值，跑多少次都一样。
 * 安全：主密钥没能持久化（只存在进程内存）时**跳过**——否则这批数据重启后解不开，
 * 会把老应用全废掉。宁可继续存明文，也不能把可用数据变成不可用的密文。
 */
export async function migratePlaintextSecrets(): Promise<void> {
  if (!isKeyPersistent()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[secret-cipher] 主密钥未持久化，跳过存量 client_secret 加密迁移（老数据继续以明文读取）',
    );
    return;
  }
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ client_id: string; client_secret: string }>(
      `SELECT client_id, client_secret FROM oidc_clients
        WHERE client_secret IS NOT NULL
          AND client_secret <> ''
          AND client_secret NOT LIKE 'enc:v1:%'`,
    );
    for (const r of rows) {
      await pool.query('UPDATE oidc_clients SET client_secret = $2 WHERE client_id = $1', [
        r.client_id,
        encryptSecret(r.client_secret),
      ]);
    }
    if (rows.length) {
      // eslint-disable-next-line no-console
      console.log(`[secret-cipher] 存量明文 client_secret 已加密迁移：${rows.length} 条`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[secret-cipher] 存量迁移失败（不影响启动，明文仍兼容读取）：${(err as Error).message}`,
    );
  }
}
