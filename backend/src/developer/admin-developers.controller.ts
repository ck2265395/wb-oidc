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
import { getPool } from '../db/pool';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { AdminPrincipal } from '../admin/admin.types';
import { AdminAuditService } from '../admin/admin-audit.service';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperRow, toDeveloperView } from './developer.types';

/**
 * 管理端开发者管理（仅 super_admin）：审核注册、启停账号。
 */
@Controller('admin/developers')
@UseGuards(AdminAuthGuard)
export class AdminDevelopersController {
  constructor(
    private readonly audit: AdminAuditService,
    private readonly devAuth: DeveloperAuthService,
  ) {}

  private assertSuper(admin: AdminPrincipal): void {
    if (admin.role !== 'super_admin') {
      throw new BadRequestException('需要超级管理员权限');
    }
  }

  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal, @Query('status') status?: string) {
    void admin;
    const pool = getPool();
    const params: string[] = [];
    let sql = 'SELECT * FROM oidc_developer';
    if (status && ['pending', 'active', 'suspended'].includes(status)) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query<DeveloperRow>(sql, params);
    return { data: rows.map(toDeveloperView) };
  }

  /** 审核 / 启停：pending→active 通过；suspended 拒绝或停用（带理由） */
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
      throw new BadRequestException('拒绝/停用必须填写理由');
    }
    const pool = getPool();
    const { rows } = await pool.query<DeveloperRow>(
      'UPDATE oidc_developer SET status = $2, reject_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, next, next === 'active' ? '' : reason],
    );
    if (!rows.length) throw new BadRequestException(`开发者 ${id} 不存在`);
    // 状态变化即吊销全部会话，强制重新登录
    await this.devAuth.revokeAllSessions(id);
    await this.audit.log(
      admin,
      'developer.set_status',
      rows[0].email,
      { status: next, reason },
      req.ip,
    );
    return { data: toDeveloperView(rows[0]) };
  }
}
