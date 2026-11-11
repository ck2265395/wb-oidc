import { DataSource } from 'typeorm';
import { loadConfig } from '../config/env';
import {
  OidcAdmin,
  OidcAdminLog,
  OidcAdminSession,
  OidcClient,
  OidcDeveloper,
  OidcDeveloperSession,
  OidcProviderState,
} from './entities';
import { InitialSchema1731200000000 } from './migrations/1731200000000-InitialSchema';

let _ds: DataSource | null = null;
let _ready: Promise<void> | null = null;

/**
 * 全局唯一 DataSource（实体 + 迁移注册）。
 * 不开启 migrationsRun：应用启动绝不自动执行 DDL（多实例并发竞争、迁移失败拖垮启动、
 * revert 后重启又把迁移跑回去）。迁移一律显式执行：npm run migration:run。
 * 种子脚本/初始化脚本需要建表时，自行调用 ds.runMigrations()（幂等）。
 */
export function getDataSource(): DataSource {
  if (!_ds) {
    const cfg = loadConfig().pg;
    _ds = new DataSource({
      type: 'postgres',
      host: cfg.host,
      port: cfg.port,
      username: cfg.user,
      password: cfg.password,
      database: cfg.database,
      poolSize: 10,
      entities: [
        OidcClient,
        OidcProviderState,
        OidcAdmin,
        OidcAdminSession,
        OidcAdminLog,
        OidcDeveloper,
        OidcDeveloperSession,
      ],
      migrations: [InitialSchema1731200000000],
      // 禁止启动时自动跑迁移（显式 npm run migration:run），理由见上方注释
      migrationsRun: false,
      synchronize: false,
    });
    _ready = _ds
      .initialize()
      .then(() => undefined)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[pg] 数据源初始化/迁移失败:', err.message);
        throw err;
      });
  }
  return _ds;
}

/** 等待连接建立（不含迁移；迁移用 npm run migration:run 或脚本内 runMigrations） */
export async function waitReady(): Promise<void> {
  getDataSource();
  if (_ready) await _ready;
}

export async function closeDataSource(): Promise<void> {
  if (_ds) {
    await _ds.destroy();
    _ds = null;
    _ready = null;
  }
}
