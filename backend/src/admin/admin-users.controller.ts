import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import { AdminUsersService, CreateAdminDto, UpdateAdminDto } from './admin-users.service';

/** 管理员账号管理：仅 super_admin 可见可操作 */
@Controller('admin/users')
@UseGuards(AdminAuthGuard)
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AdminAuditService,
  ) {}

  private assertSuper(admin: AdminPrincipal): void {
    if (admin.role !== 'super_admin') {
      throw new ForbiddenException('需要超级管理员权限');
    }
  }

  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal) {
    this.assertSuper(admin);
    return { data: await this.users.list() };
  }

  @Post()
  async create(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: CreateAdminDto,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const created = await this.users.create(dto);
    await this.audit.log(admin, 'admin.user.create', created.username, { role: created.role }, req.ip);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const updated = await this.users.update(id, dto, admin.id);
    await this.audit.log(admin, 'admin.user.update', updated.username, { ...dto }, req.ip);
    return { data: updated };
  }

  @Post(':id/reset-password')
  async resetPassword(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password?: string },
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    await this.users.resetPassword(id, String(body?.password || ''));
    await this.audit.log(admin, 'admin.user.reset_password', String(id), undefined, req.ip);
    return { ok: true };
  }
}
