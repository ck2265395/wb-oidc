import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PageDto } from '../common/page.dto';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import { AdminOpsService } from './admin-ops.service';
import { LegacyUserService } from '../oidc/legacy/legacy-user.service';
import {
  AdminLogListRes,
  LegacyUserListRes,
  OverviewRes,
  SessionListRes,
} from './admin.dto';
import { OkRes } from '../common/api.dto';

/**
 * 管理端运营接口：审计日志 / 概览统计 / 会话管理 / 老库用户查询。
 * 全部只读（会话吊销除外），查询逻辑在 AdminOpsService，鉴权沿用 AdminAuthGuard。
 */
@ApiTags('管理端-运营')
@ApiBearerAuth('bearer')
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminOpsController {
  constructor(
    private readonly ops: AdminOpsService,
    private readonly legacy: LegacyUserService,
  ) {}

  // ============ 审计日志 ============

  @Get('logs')
  @ApiOperation({ summary: '审计日志列表', description: '按 action / username 模糊过滤，时间倒序分页' })
  @ApiQuery({ name: 'action', required: false, description: '操作类型模糊匹配，如 client.create' })
  @ApiQuery({ name: 'username', required: false, description: '操作者账号模糊匹配' })
  @ApiOkResponse({ type: AdminLogListRes })
  async logs(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query() q: PageDto,
    @Query('action') action?: string,
    @Query('username') username?: string,
  ) {
    void admin;
    const result = await this.ops.listLogs(q.page, q.size, action, username);
    return { data: result.data, total: result.total, page: q.page, size: q.size };
  }

  // ============ 概览统计 ============

  @Get('overview')
  @ApiOperation({ summary: '运营概览', description: '应用/开发者各状态计数、活跃会话数、老库用户数与最近 8 条审计日志' })
  @ApiOkResponse({ type: OverviewRes })
  async overview(@CurrentAdmin() admin: AdminPrincipal) {
    void admin;
    return { data: await this.ops.overview() };
  }

  // ============ 会话管理 ============

  /** oidc-provider 会话列表（model = Session），含登录账号与已授权应用数 */
  @Get('sessions')
  @ApiOperation({ summary: 'OIDC 会话列表', description: 'provider Session 分页列表，含登录账号、登录时间与已授权应用数' })
  @ApiOkResponse({ type: SessionListRes })
  async sessions(@CurrentAdmin() admin: AdminPrincipal, @Query() q: PageDto) {
    void admin;
    const result = await this.ops.listSessions(q.page, q.size);
    return { data: result.data, total: result.total, page: q.page, size: q.size };
  }

  /** 吊销会话（删除 provider state 行，用户下次访问需重新登录） */
  @Delete('sessions/:id')
  @ApiOperation({ summary: '吊销会话', description: '删除 provider state 行，用户下次访问需重新登录' })
  @ApiOkResponse({ type: OkRes })
  async revokeSession(@CurrentAdmin() admin: AdminPrincipal, @Param('id') id: string) {
    void admin;
    if (!id) throw new BadRequestException('缺少会话 ID');
    await this.ops.revokeSession(id);
    return { ok: true };
  }

  // ============ 老库用户查询（只读） ============

  @Get('legacy-users')
  @ApiOperation({ summary: '老系统用户查询（只读）', description: '按用户名/邮箱/手机号模糊搜索老库；密码哈希与盐字段脱敏为 ******' })
  @ApiQuery({ name: 'keyword', required: false, description: '用户名/邮箱/手机号模糊匹配' })
  @ApiOkResponse({ type: LegacyUserListRes })
  async legacyUsers(
    @CurrentAdmin() admin: AdminPrincipal,
    @Query('keyword') keyword?: string,
    @Query() q?: PageDto,
  ) {
    void admin;
    const page = q ?? new PageDto();
    const result = await this.legacy.search(
      String(keyword || '').trim(),
      page.page,
      page.size,
    );
    return { ...result, page: page.page, size: page.size };
  }
}
