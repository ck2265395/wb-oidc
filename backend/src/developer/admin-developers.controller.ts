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
    let sql = 'SELECT * FROM oidc_developer';
    const params: string[] = [];
    // 资格筛选
    if (status && ['none', 'pending', 'approved', 'rejected'].includes(status)) {
      sql += ' WHERE developer_status = $1';
      params.push(status);
    } else if (status === 'suspended') {
      sql += " WHERE status = 'suspended'";
    }
    sql += ' ORDER BY COALESCE(developer_applied_at, created_at) DESC, created_at DESC';
    const { rows } = await pool.query<DeveloperRow>(sql, params);
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
    const pool = getPool();
    const { rows } = await pool.query<DeveloperRow>(
      `UPDATE oidc_developer
          SET developer_status = $2,
              developer_reject_reason = $3,
              updated_at = NOW()
        WHERE id = $1 AND developer_status = 'pending'
        RETURNING *`,
      [id, next, action === 'approve' ? '' : reason],
    );
    if (!rows.length) {
      throw new BadRequestException('该用户没有待审核的开发者资格申请');
    }
    await this.audit.log(
      admin,
      'developer.review',
      rows[0].email,
      { action, status: next, reason },
      req.ip,
    );
    return { data: toDeveloperView(rows[0]) };
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
    const pool = getPool();
    const { rows } = await pool.query<DeveloperRow>(
      'UPDATE oidc_developer SET status = $2, reject_reason = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, next, next === 'active' ? '' : reason],
    );
    if (!rows.length) throw new BadRequestException(`用户 ${id} 不存在`);
    // 账号状态变化即吊销全部会话，强制重新登录
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
