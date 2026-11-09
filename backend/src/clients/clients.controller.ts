import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientsService, CreateClientDto, ClientRow } from './clients.service';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { AdminPrincipal } from '../admin/admin.types';

/**
 * 管理端 API：注册/管理第三方应用。
 * 鉴权：AdminAuthGuard（Bearer access token），操作写审计日志。
 */
@Controller('admin/clients')
@UseGuards(AdminAuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  async list(@CurrentAdmin() admin: AdminPrincipal): Promise<{ data: ClientRow[] }> {
    void admin;
    const rows = await this.clientsService.list();
    return { data: rows };
  }

  @Post()
  async create(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: CreateClientDto,
    @Req() req: Request,
  ): Promise<{ data: ClientRow; client_secret: string }> {
    const { client, secret } = await this.clientsService.create(dto);
    await this.audit.log(admin, 'client.create', client.client_id, { name: client.client_name }, req.ip);
    return { data: client, client_secret: secret };
  }

  @Get(':clientId')
  async detail(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
  ): Promise<{ data: ClientRow }> {
    void admin;
    const row = await this.clientsService.get(clientId);
    if (!row) throw new NotFoundException(`client ${clientId} 不存在`);
    return { data: row };
  }

  @Patch(':clientId/enabled/:enabled')
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

  @Post(':clientId/rotate-secret')
  async rotateSecret(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('clientId') clientId: string,
    @Req() req: Request,
  ): Promise<{ data: ClientRow; client_secret: string }> {
    const { client, secret } = await this.clientsService.rotateSecret(clientId);
    await this.audit.log(admin, 'client.rotate_secret', clientId, undefined, req.ip);
    return { data: client, client_secret: secret };
  }

  @Delete(':clientId')
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
