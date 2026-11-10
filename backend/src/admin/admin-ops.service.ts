import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull, MoreThan } from 'typeorm';
import {
  OidcAdminLog,
  OidcAdminSession,
  OidcClient,
  OidcDeveloper,
  OidcProviderState,
} from '../db/entities';
import { LegacyUserService } from '../oidc/legacy/legacy-user.service';

/**
 * 管理端运营查询：审计日志 / 概览统计 / OIDC 会话管理。
 * 全部只读（会话吊销除外）；老库用户查询走 LegacyUserService（老库动态表，保留参数化原生 SQL）。
 */
@Injectable()
export class AdminOpsService {
  constructor(
    @Inject(DataSource) private readonly ds: DataSource,
    private readonly legacy: LegacyUserService,
  ) {}

  async listLogs(
    page: number,
    size: number,
    action?: string,
    username?: string,
  ): Promise<{ data: OidcAdminLog[]; total: number; page: number; size: number }> {
    const qb = this.ds.getRepository(OidcAdminLog).createQueryBuilder('l');
    if (action) qb.andWhere('l.action ILIKE :action', { action: `%${action}%` });
    if (username) qb.andWhere('l.username ILIKE :username', { username: `%${username}%` });
    const total = await qb.getCount();
    const data = await qb
      .orderBy('l.createdAt', 'DESC')
      .take(size)
      .skip((page - 1) * size)
      .getMany();
    return { data, total, page, size };
  }

  async overview(): Promise<Record<string, unknown>> {
    const clientRepo = this.ds.getRepository(OidcClient);
    const devRepo = this.ds.getRepository(OidcDeveloper);
    const logRepo = this.ds.getRepository(OidcAdminLog);
    const stateRepo = this.ds.getRepository(OidcProviderState);

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
      clientRepo.count(),
      clientRepo.count({ where: { status: 'pending' } }),
      clientRepo.count({ where: { status: 'approved' } }),
      clientRepo.count({ where: { status: 'rejected' } }),
      clientRepo.count({ where: { status: 'suspended' } }),
      devRepo.count(),
      devRepo.count({ where: { developerStatus: 'pending' } }),
      devRepo.count({ where: { developerStatus: 'approved' } }),
      devRepo.count({ where: { status: 'suspended' } }),
      devRepo.count({ where: { developerStatus: 'none' } }),
      this.ds.getRepository(OidcAdminSession).count({
        where: { revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      }),
      stateRepo.count({ where: { model: 'Session' } }),
      this.legacy.countUsers().catch(() => '0'),
    ]);

    const recentLogs = await logRepo.find({
      select: ['id', 'username', 'action', 'target', 'ip', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: 8,
    });

    return {
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
    };
  }

  /** oidc-provider 会话列表（model = Session），含登录账号与已授权应用数 */
  async listSessions(
    page: number,
    size: number,
  ): Promise<{ data: Array<Record<string, unknown>>; total: number; page: number; size: number }> {
    const stateRepo = this.ds.getRepository(OidcProviderState);
    const total = await stateRepo.count({ where: { model: 'Session' } });
    const rows = await stateRepo.find({
      where: { model: 'Session' },
      order: { expiresAt: 'DESC' },
      take: size,
      skip: (page - 1) * size,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        account_id: row.data?.accountId ?? null,
        login_at: row.data?.iat ? new Date(row.data.iat * 1000).toISOString() : null,
        authorized_clients: Object.keys(row.data?.authorizations || {}).length,
        expires_at: row.expiresAt,
      })),
      total,
      page,
      size,
    };
  }

  /** 吊销会话（删除 provider state 行，用户下次访问需重新登录） */
  async revokeSession(id: string): Promise<void> {
    const result = await this.ds
      .getRepository(OidcProviderState)
      .delete({ model: 'Session', id });
    if (!result.affected) {
      throw new BadRequestException(`会话 ${id} 不存在或已结束`);
    }
  }
}
