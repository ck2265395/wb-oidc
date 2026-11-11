import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { AdminPrincipal } from '../admin/admin.types';
import { AdminAuditService } from '../admin/admin-audit.service';
import { DeveloperAuthService } from './developer-auth.service';
import { AdminDevelopersService } from './admin-developers.service';
import { toDeveloperView } from './developer.types';
import { DevReviewBody, DevStatusBody, DeveloperItemRes, DeveloperListRes } from './developer.dto';

/**
 * 管理端用户 / 开发者管理（仅 super_admin 可写）：
 * - 开发者资格审核：/review（pending → approved / rejected）
 * - 账号启停：/status（active / suspended）
 */
@ApiTags('管理端-开发者管理')
@ApiBearerAuth('bearer')
@UseGuards(AdminAuthGuard)
@Controller('admin/developers')
export class AdminDevelopersController {
  constructor(
    private readonly audit: AdminAuditService,
    private readonly devAuth: DeveloperAuthService,
    private readonly service: AdminDevelopersService,
  ) {}

  private assertSuper(admin: AdminPrincipal): void {
    if (admin.role !== 'super_admin') {
      throw new BadRequestException('需要超级管理员权限');
    }
  }

  @Get()
  @ApiOperation({ summary: '开发者列表', description: '可按资格状态过滤：none/pending/approved/rejected；或按账号状态 active/suspended' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: '过滤状态（自动识别资格状态或账号状态）',
  })
  @ApiOkResponse({ type: DeveloperListRes })
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    void admin;
    const rows = await this.service.list(status);
    return { data: rows.map(toDeveloperView) };
  }

  /** 审核开发者资格申请 */
  @Patch(':id/review')
  @ApiOperation({ summary: '审核开发者资格', description: 'approve 通过 / reject 驳回（必填理由）；仅 super_admin' })
  @ApiOkResponse({ type: DeveloperItemRes })
  async review(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DevReviewBody,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const action = body?.action;
    if (action !== 'approve' && action !== 'reject') {
      throw new BadRequestException('action 必须是 approve 或 reject');
    }
    const reason = String(body?.reason || '').trim();
    if (action === 'reject' && !reason) {
      throw new BadRequestException('驳回必须填写理由');
    }
    const next = action === 'approve' ? 'approved' : 'rejected';
    const row = await this.service.review(id, next, action === 'approve' ? '' : reason);
    await this.audit.log(
      admin,
      'developer.review',
      row.email,
      { action, status: next, reason },
      req.ip,
    );
    return { data: toDeveloperView(row) };
  }

  /** 账号启停（与开发者资格解耦） */
  @Patch(':id/status')
  @ApiOperation({ summary: '开发者账号启停', description: 'suspended 必填理由；状态变化即吊销全部会话，强制重新登录；仅 super_admin' })
  @ApiOkResponse({ type: DeveloperItemRes })
  async setStatus(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: DevStatusBody,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const next = body?.status;
    if (!next || !['active', 'suspended'].includes(next)) {
      throw new BadRequestException('status 必须是 active 或 suspended');
    }
    const reason = String(body?.reason || '');
    if (next === 'suspended' && !reason) {
      throw new BadRequestException('停用必须填写理由');
    }
    const row = await this.service.setStatus(id, next, next === 'active' ? '' : reason);
    // 账号状态变化即吊销全部会话，强制重新登录
    await this.devAuth.revokeAllSessions(id);
    await this.audit.log(
      admin,
      'developer.set_status',
      row.email,
      { status: next, reason },
      req.ip,
    );
    return { data: toDeveloperView(row) };
  }
}
