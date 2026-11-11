import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClientsService, CreateClientDto, ClientRow } from './clients.service';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminPrincipal } from '../admin/admin.types';
import {
  ClientCreateRes,
  ClientItemRes,
  ClientListRes,
  ClientReviewBody,
  CreateClientBody,
  UpdateClientBody,
} from './clients.dto';
import { OkRes } from '../common/api.dto';
import { BizException } from '../common/biz.exception';
import { ERROR_CODE } from '../common/error-code';

/**
 * 管理端 API：注册/管理第三方应用。
 * 鉴权：AdminAuthGuard（Bearer access token），操作写审计日志。
 */
@ApiTags('管理端-第三方应用')
@ApiBearerAuth('bearer')
@UseGuards(AdminAuthGuard)
@Controller('admin/clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '应用列表', description: '返回全部应用（含 client_secret 密文与归属开发者邮箱）' })
  @ApiOkResponse({ type: ClientListRes })
  async list(@CurrentAdmin() admin: AdminPrincipal): Promise<{ data: ClientRow[] }> {
    void admin;
    const rows = await this.clientsService.list();
    return { data: rows };
  }

  @Post()
  @ApiOperation({ summary: '直接创建应用', description: '管理端创建默认即 approved；返回的 client_secret 明文仅此一次' })
  @ApiOkResponse({ type: ClientCreateRes })
  async create(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: CreateClientBody,
    @Req() req: Request,
  ): Promise<{ data: ClientRow; client_secret: string }> {
    const { client, secret } = await this.clientsService.create(dto as CreateClientDto);
    await this.audit.log(admin, 'client.create', client.client_id, { name: client.client_name }, req.ip);
    return { data: client, client_secret: secret };
  }

  @Get(':clientId')
  @ApiOperation({ summary: '应用详情' })
  @ApiOkResponse({ type: ClientItemRes })
  async detail(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
  ): Promise<{ data: ClientRow }> {
    void admin;
    const row = await this.clientsService.get(clientId);
    if (!row) throw new BizException(ERROR_CODE.APP_NOT_FOUND, `应用 ${clientId} 不存在`);
    return { data: row };
  }

  @Patch(':clientId/enabled/:enabled')
  @ApiOperation({ summary: '启停应用', description: 'enabled 取 true/1 即启用，其余为停用；与审核状态独立' })
  @ApiOkResponse({ type: ClientItemRes })
  async toggle(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Param('enabled') enabled: string,
    @Req() req: Request,
  ): Promise<{ data: ClientRow }> {
    const value = enabled === 'true' || enabled === '1';
    const row = await this.clientsService.toggleEnabled(clientId, value);
    await this.audit.log(admin, 'client.toggle', clientId, { enabled: value }, req.ip);
    return { data: row };
  }

  /** 通用编辑：应用名称 / 回调地址 / scope */
  @Patch(':clientId')
  @ApiOperation({ summary: '编辑应用', description: '可改名称/回调/scope/类目/展示信息；类目变更会同步调整安全形态（secret 补发或清空）' })
  @ApiOkResponse({ type: ClientItemRes })
  async update(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Body()
    dto: UpdateClientBody,
    @Req() req: Request,
  ): Promise<{ data: ClientRow }> {
    const row = await this.clientsService.update(clientId, dto);
    await this.audit.log(
      admin,
      'client.update',
      clientId,
      { fields: Object.keys(dto) },
      req.ip,
    );
    return { data: row };
  }

  @Post(':clientId/rotate-secret')
  @ApiOperation({ summary: '轮换 client_secret', description: '生成新 secret 并覆盖旧值，新明文仅此次返回' })
  @ApiOkResponse({ type: ClientCreateRes })
  async rotateSecret(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Req() req: Request,
  ): Promise<{ data: ClientRow; client_secret: string }> {
    const { client, secret } = await this.clientsService.rotateSecret(clientId);
    await this.audit.log(admin, 'client.rotate_secret', clientId, undefined, req.ip);
    return { data: client, client_secret: secret };
  }

  /** 应用审核：approve / reject / suspend（reject、suspend 必须带理由） */
  @Post(':clientId/review')
  @ApiOperation({ summary: '应用审核', description: 'approve 通过 / reject 驳回 / suspend 停用；reject、suspend 必须带理由' })
  @ApiOkResponse({ type: ClientItemRes })
  async review(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Body() body: ClientReviewBody,
    @Req() req: Request,
  ): Promise<{ data: ClientRow }> {
    const action = body?.action;
    const reason = String(body?.reason || '');
    if (!action || !['approve', 'reject', 'suspend'].includes(action)) {
      throw new BizException(ERROR_CODE.PARAM_INVALID, 'action 必须是 approve / reject / suspend');
    }
    if (action !== 'approve' && !reason) {
      throw new BizException(ERROR_CODE.PARAM_INVALID, '拒绝或停用必须填写理由');
    }
    const status =
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'suspended';
    const row = await this.clientsService.setStatus(clientId, status, reason);
    await this.audit.log(admin, 'client.review', clientId, { action, reason }, req.ip);
    return { data: row };
  }

  @Delete(':clientId')
  @ApiOperation({ summary: '删除应用', description: '物理删除，不可恢复' })
  @ApiOkResponse({ type: OkRes })
  async remove(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    await this.clientsService.remove(clientId);
    await this.audit.log(admin, 'client.delete', clientId, undefined, req.ip);
    return { ok: true };
  }
}
