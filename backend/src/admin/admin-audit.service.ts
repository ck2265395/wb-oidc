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

  async list(limit = 100): Promise<Array<Record<string, unknown>>> {
    const { rows } = await getPool().query(
      'SELECT * FROM oidc_admin_log ORDER BY created_at DESC LIMIT $1',
      [Math.min(Math.max(limit, 1), 500)],
    );
    return rows;
  }
}
