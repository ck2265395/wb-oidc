import 'dotenv/config';
import 'reflect-metadata';
import { getDataSource } from './data-source';

/**
 * TypeORM CLI 专用数据源入口（migration:run / revert / show 通过 -d 指向本文件编译产物）。
 * 与运行时共用同一份配置和迁移注册，保证 CLI 与启动时行为一致。
 */
export default getDataSource();
