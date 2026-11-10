import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import { AdminOpsService } from './admin-ops.service';
import { LegacyUserService } from '../oidc/legacy/legacy-user.service';

/**
 * 管理端运营接口：审计日志 / 概览统计 / 会话管理 / 老库用户查询。
 * 全部只读（会话吊销除外），查询逻辑在 AdminOpsService，鉴权沿用 AdminAuthGuard。
 */
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminOpsController {
  constructor(
    private readonly ops: AdminOpsService,
    private readonly legacy: LegacyUserService,
  ) {}

  private pageParams(page?: string, size?: string): { pageNo: number; pageSize: number } {
    return {
      pageNo: Math.max(1, parseInt(page || '1', 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(size || '20', 10) || 20)),
    };
  }

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
    const { pageNo, pageSize } = this.pageParams(page, size);
    const result = await this.ops.listLogs(pageNo, pageSize, action, username);
    return { data: result.data, total: result.total, page: pageNo, size: pageSize };
  }

  // ============ 概览统计 ============

  @Get('overview')
  async overview(@CurrentAdmin() admin: AdminPrincipal) {
    void admin;
    return { data: await this.ops.overview() };
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
    const { pageNo, pageSize } = this.pageParams(page, size);
    const result = await this.ops.listSessions(pageNo, pageSize);
    return { data: result.data, total: result.total, page: pageNo, size: pageSize };
  }

  /** 吊销会话（删除 provider state 行，用户下次访问需重新登录） */
  @Delete('sessions/:id')
  async revokeSession(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    void admin;
    if (!id) throw new BadRequestException('缺少会话 ID');
    await this.ops.revokeSession(id);
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
    const { pageNo, pageSize } = this.pageParams(page, size);
    const result = await this.legacy.search(
      String(keyword || '').trim(),
      pageNo,
      pageSize,
    );
    return { ...result, page: pageNo, size: pageSize };
  }
}
