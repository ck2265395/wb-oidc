import { LessThan } from 'typeorm';
import { getDataSource } from '../db/data-source';
import { OidcProviderState } from '../db/entities';

const CLEAN_INTERVAL_MS = 60 * 60_000;

/**
 * 定时清理 oidc_provider_state 中已过期超过 1 天的协议状态
 * （Session/Grant/Token 等行不会自动消失，不清理会持续膨胀）。
 */
export function startStateCleanup(): void {
  const timer = setInterval(async () => {
    try {
      const repo = getDataSource().getRepository(OidcProviderState);
      const result = await repo.delete({ expiresAt: LessThan(new Date(Date.now() - 86400_000)) });
      if (result.affected) {
        // eslint-disable-next-line no-console
        console.log(`[cleanup] 清理过期 provider state ${result.affected} 条`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[cleanup] provider state 清理失败:', (err as Error).message);
    }
  }, CLEAN_INTERVAL_MS);
  timer.unref();
}
