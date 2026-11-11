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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import { AdminUsersService, CreateAdminDto, UpdateAdminDto } from './admin-users.service';
import {
  AdminUserItemRes,
  AdminUserListRes,
  CreateAdminBody,
  ResetPasswordBody,
  UpdateAdminBody,
} from './admin.dto';
import { OkRes } from '../common/api.dto';

/** 管理员账号管理：仅 super_admin 可见可操作 */
@ApiTags('管理端-管理员账号')
@ApiBearerAuth('bearer')
@UseGuards(AdminAuthGuard)
@Controller('admin/users')
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
  @ApiOperation({ summary: '管理员列表', description: '仅 super_admin 可调用' })
  @ApiOkResponse({ type: AdminUserListRes })
  async list(@CurrentAdmin() admin: AdminPrincipal) {
    this.assertSuper(admin);
    return { data: await this.users.list() };
  }

  @Post()
  @ApiOperation({ summary: '创建管理员', description: '仅 super_admin；用户名 3-32 位字母/数字/_.-' })
  @ApiOkResponse({ type: AdminUserItemRes })
  async create(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: CreateAdminBody,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const created = await this.users.create(dto as CreateAdminDto);
    await this.audit.log(admin, 'admin.user.create', created.username, { role: created.role }, req.ip);
    return { data: created };
  }

  @Patch(':id')
  @ApiOperation({ summary: '编辑管理员', description: '仅 super_admin；不允许停用自己或降级最后一个超管' })
  @ApiOkResponse({ type: AdminUserItemRes })
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminBody,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    const updated = await this.users.update(id, dto as UpdateAdminDto, admin.id);
    await this.audit.log(admin, 'admin.user.update', updated.username, { ...dto }, req.ip);
    return { data: updated };
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: '重置管理员密码', description: '仅 super_admin；重置后该管理员全部会话被吊销，强制重新登录' })
  @ApiOkResponse({ type: OkRes })
  async resetPassword(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordBody,
    @Req() req: Request,
  ) {
    this.assertSuper(admin);
    await this.users.resetPassword(id, String(body?.password || ''));
    await this.audit.log(admin, 'admin.user.reset_password', String(id), undefined, req.ip);
    return { ok: true };
  }
}
