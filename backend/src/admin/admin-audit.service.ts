import { Injectable } from '@nestjs/common';
import { getPool } from '../db/pool';
import { AdminPrincipal } from './admin.types';

/**
 * 管理端操作审计：谁、什么时候、从哪个 IP、对哪个对象做了什么。
 * 写入失败不影响主流程（审计不能反过来把业务打挂）。
 */
@Injectable()
export class AdminAuditService {
  async log(
    admin: AdminPrincipal | null,
    action: string,
    target?: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      await getPool().query(
        `INSERT INTO oidc_admin_log (admin_id, username, action, target, detail, ip)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
        [
          admin?.id ?? null,
          admin?.username ?? null,
          action,
          target ?? null,
          detail ? JSON.stringify(detail) : null,
          ip ?? null,
        ],
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit] 写入失败:', (err as Error).message);
    }
  }

  /**
   * 开发者侧操作审计（复用同一张表）。
   * 与管理员共用表，靠 username 前缀 `developer:` 区分，admin_id 留空避免与管理员 id 混淆。
   */
  async logDeveloper(
    developer: { id: number; email: string } | null,
    action: string,
    target?: string,
    detail?: Record<string, unknown>,
    ip?: string,
  ): Promise<void> {
    try {
      await getPool().query(
        `INSERT INTO oidc_admin_log (admin_id, username, action, target, detail, ip)
         VALUES (NULL,$1,$2,$3,$4::jsonb,$5)`,
        [
          developer ? `developer:${developer.email}` : 'developer:anonymous',
          action,
          target ?? null,
          detail ? JSON.stringify({ ...detail, developer_id: developer?.id ?? null }) : null,
          ip ?? null,
        ],
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[audit] 开发者审计写入失败:', (err as Error).message);
    }
  }

  async list(limit = 100): Promise<Array<Record<string, unknown>>> {
    const { rows } = await getPool().query(
      'SELECT * FROM oidc_admin_log ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(limit, 1), 500)],
    );
    return rows;
  }
}
