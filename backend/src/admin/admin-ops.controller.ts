import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { getPool } from '../db/pool';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import { LegacyUserService } from '../oidc/legacy/legacy-user.service';

/**
 * 管理端运营接口：审计日志 / 概览统计 / 会话管理 / 老库用户查询。
 * 全部只读（会话吊销除外），鉴权沿用 AdminAuthGuard。
 */
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminOpsController {
  constructor(private readonly legacy: LegacyUserService) {}

  // ============ 审计日志 ============

  @Get('logs')
  async logs(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
  ) {
    void admin;
    const pageNo = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(size || '20', 10) || 20));
    const pool = getPool();

    const where: string[] = [];
    const params: unknown[] = [];
    if (action) {
      params.push(`%${action}%`);
      where.push(`action ILIKE $${params.length}`);
    }
    if (username) {
      params.push(`%${username}%`);
      where.push(`username ILIKE $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM oidc_admin_log ${whereSql}`,
      params,
    );
    const total = parseInt(countRows[0]?.count || '0', 10);
    params.push(pageSize, (pageNo - 1) * pageSize);
    const { rows } = await pool.query(
      `SELECT id, admin_id, username, action, target, detail, ip, created_at
         FROM oidc_admin_log ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { data: rows, total, page: pageNo, size: pageSize };
  }

  // ============ 概览统计 ============

  @Get('overview')
  async overview(@CurrentAdmin() admin: AdminPrincipal) {
    void admin;
    const pool = getPool();
    const q = async (sql: string, params: unknown[] = []): Promise<string> => {
      const { rows } = await pool.query<{ count: string }>(sql, params);
      return rows[0]?.count || '0';
    };

    const [
      clientsTotal,
      clientsPending,
      clientsApproved,
      clientsRejected,
      clientsSuspended,
      developersTotal,
      developersPending,
      developersActive,
      developersSuspended,
      developersNormal,
      adminSessionsActive,
      providerSessions,
      legacyUsers,
    ] = await Promise.all([
      q('SELECT COUNT(*)::text AS count FROM oidc_clients'),
      q("SELECT COUNT(*)::text AS count FROM oidc_clients WHERE status = 'pending'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_clients WHERE status = 'approved'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_clients WHERE status = 'rejected'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_clients WHERE status = 'suspended'"),
      q('SELECT COUNT(*)::text AS count FROM oidc_developer'),
      q("SELECT COUNT(*)::text AS count FROM oidc_developer WHERE developer_status = 'pending'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_developer WHERE developer_status = 'approved'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_developer WHERE status = 'suspended'"),
      q("SELECT COUNT(*)::text AS count FROM oidc_developer WHERE developer_status = 'none'"),
      q(
        'SELECT COUNT(*)::text AS count FROM oidc_admin_session WHERE revoked_at IS NULL AND expires_at > NOW()',
      ),
      q("SELECT COUNT(*)::text AS count FROM oidc_provider_state WHERE model = 'Session'"),
      this.legacy.countUsers().catch(() => '0'),
    ]);

    const { rows: recentLogs } = await pool.query(
      `SELECT id, username, action, target, ip, created_at
         FROM oidc_admin_log ORDER BY created_at DESC LIMIT 8`,
    );

    return {
      data: {
        clients: {
          total: clientsTotal,
          pending: clientsPending,
          approved: clientsApproved,
          rejected: clientsRejected,
          suspended: clientsSuspended,
        },
        developers: {
          total: developersTotal,
          pending: developersPending,
          active: developersActive,
          suspended: developersSuspended,
          normal: developersNormal,
        },
        admin_sessions_active: adminSessionsActive,
        provider_sessions: providerSessions,
        legacy_users: legacyUsers,
        recent_logs: recentLogs,
      },
    };
  }

  // ============ 会话管理 ============

  /** oidc-provider 会话列表（model = Session），含登录账号与已授权应用数 */
  @Get('sessions')
  async sessions(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    void admin;
    const pageNo = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(size || '20', 10) || 20));
    const pool = getPool();

    const { rows: countRows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM oidc_provider_state WHERE model = 'Session'`,
    );
    const total = parseInt(countRows[0]?.count || '0', 10);

    const { rows } = await pool.query<{
      id: string;
      data: Record<string, any>;
      expires_at: string | null;
    }>(
      `SELECT id, data, expires_at
         FROM oidc_provider_state
        WHERE model = 'Session'
        ORDER BY expires_at DESC
        LIMIT $1 OFFSET $2`,
      [pageSize, (pageNo - 1) * pageSize],
    );

    return {
      data: rows.map((row) => ({
        id: row.id,
        account_id: row.data?.accountId ?? null,
        login_at: row.data?.iat ? new Date(row.data.iat * 1000).toISOString() : null,
        authorized_clients: Object.keys(row.data?.authorizations || {}).length,
        expires_at: row.expires_at,
      })),
      total,
      page: pageNo,
      size: pageSize,
    };
  }

  /** 吊销会话（删除 provider state 行，用户下次访问需重新登录） */
  @Delete('sessions/:id')
  async revokeSession(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    void req;
    void admin;
    if (!id) throw new BadRequestException('缺少会话 ID');
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM oidc_provider_state WHERE model = 'Session' AND id = $1`,
      [id],
    );
    if (!result.rowCount) throw new BadRequestException(`会话 ${id} 不存在或已结束`);
    return { ok: true };
  }

  // ============ 老库用户查询（只读） ============

  @Get('legacy-users')
  async legacyUsers(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
  ) {
    void admin;
    const pageNo = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(size || '20', 10) || 20));
    const result = await this.legacy.search(
      String(keyword || '').trim(),
      pageNo,
      pageSize,
    );
    return { ...result, page: pageNo, size: pageSize };
  }
}
