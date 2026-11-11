import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OidcAdminLog } from '../db/entities';
import { AdminPrincipal } from './admin.types';

/**
 * 管理端操作审计：谁、什么时候、从哪个 IP、对哪个对象做了什么。
 * 写入失败不影响主流程（审计不能反过来把业务打挂）。
 */
@Injectable()
export class AdminAuditService {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  async log(
    admin: AdminPrincipal | null,
    action: string,
    target?: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      const repo = this.ds.getRepository(OidcAdminLog);
      const row = repo.create({
        actorType: 'admin',
        adminId: admin ? admin.id : null,
        username: admin?.username ?? null,
        action,
        target: target ?? null,
        detail: detail ?? null,
        ip: ip ?? null,
      });
      await repo.insert(row);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit] 写入失败:', (err as Error).message);
    }
  }

  /**
   * 开发者侧操作审计（复用同一张表，actor_type='developer' 显式区分）。
   * admin_id 留空避免与管理员 uuid 混淆，开发者 uuid 记录在 detail.developer_id。
   */
  async logDeveloper(
    developer: { id: string; email: string } | null,
    action: string,
    target?: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      const repo = this.ds.getRepository(OidcAdminLog);
      const row = repo.create({
        actorType: 'developer',
        adminId: null,
        username: developer ? `developer:${developer.email}` : 'developer:anonymous',
        action,
        target: target ?? null,
        detail: { ...(detail ?? {}), developer_id: developer?.id ?? null },
        ip: ip ?? null,
      });
      await repo.insert(row);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit] 开发者审计写入失败:', (err as Error).message);
    }
  }

  async list(limit = 100): Promise<Array<Record<string, unknown>>> {
    const rows = await this.ds.getRepository(OidcAdminLog).find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows as unknown as Array<Record<string, unknown>>;
  }
}
