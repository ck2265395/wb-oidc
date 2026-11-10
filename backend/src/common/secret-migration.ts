import { getDataSource } from '../db/data-source';
import { OidcClient } from '../db/entities';
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
    const repo = getDataSource().getRepository(OidcClient);
    const rows = await repo
      .createQueryBuilder('c')
      .select(['c.clientId', 'c.clientSecret'])
      .where("c.clientSecret <> ''")
      .andWhere("c.clientSecret NOT LIKE 'enc:v1:%'")
      .getMany();
    for (const r of rows) {
      if (!r.clientSecret) continue;
      await repo.update({ clientId: r.clientId }, { clientSecret: encryptSecret(r.clientSecret) });
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
