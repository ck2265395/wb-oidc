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
 * 启动时 initialize 自动执行未应用的迁移（migrationsRun），
 * 等待建表完成用 waitReady()，避免首个请求与迁移竞态。
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
      migrationsRun: true,
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

/** 等待初始化与迁移完成（启动流程/种子脚本使用） */
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
