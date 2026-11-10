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
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { AdminPrincipal } from '../admin/admin.types';
import { AdminAuditService } from '../admin/admin-audit.service';
import { DeveloperAuthService } from './developer-auth.service';
import { AdminDevelopersService } from './admin-developers.service';
import { toDeveloperView } from './developer.types';

/**
 * 管理端用户 / 开发者管理（仅 super_admin 可写）：
 * - 开发者资格审核：/review（pending → approved / rejected）
 * - 账号启停：/status（active / suspended）
 */
@Controller('admin/developers')
@UseGuards(AdminAuthGuard)
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
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    void admin;
    const rows = await this.service.list(status);
    return { data: rows.map(toDeveloperView) };
  }

  /** 审核开发者资格申请 */
  @Patch(':id/review')
  async review(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action?: 'approve' | 'reject'; reason?: string },
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
  async setStatus(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: 'active' | 'suspended'; reason?: string },
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
