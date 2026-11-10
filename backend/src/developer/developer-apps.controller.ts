import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientsService, CreateClientDto, ClientRow } from '../clients/clients.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';
import { DeveloperAuthService } from './developer-auth.service';
import { AdminAuditService } from '../admin/admin-audit.service';

/** 开发者自己的应用（返回前剥离 secret 与内部字段） */
function safeClient(row: ClientRow) {
  const { client_secret, ...rest } = row;
  void client_secret;
  return rest;
}

/**
 * 开发者应用申请接口（/api/developer/apps）。
 * 流程：创建 → pending → 管理员 approve 后才能发起 OIDC 授权；
 * 审核通过后改动回调/scope 会回到 pending 重新审核。
 */
@Controller('developer/apps')
@UseGuards(DeveloperGuard)
export class DeveloperAppsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly devAuth: DeveloperAuthService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  async listMine(@Req() req: Request) {
    const dev = currentDeveloper(req);
    const rows = await this.clients.listByDeveloper(dev.id);
    return { data: rows.map(safeClient) };
  }

  @Get(':clientId')
  async getOne(@Req() req: Request, @Param('clientId') clientId: string) {
    const dev = currentDeveloper(req);
    const row = await this.clients.get(clientId);
    if (!row) throw new BadRequestException(`应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);
    return { data: safeClient(row) };
  }

  /**
   * 查看 client_secret 明文。
   * 需要重新输入登录密码做二次验证，且每次查看（成功/失败）都写审计日志。
   * 移动应用 / 小程序走 PKCE 没有 secret，返回 client_secret: null。
   */
  @Post(':clientId/reveal-secret')
  async revealSecret(
    @Req() req: Request,
    @Param('clientId') clientId: string,
    @Body() body: { password?: string },
  ) {
    const dev = currentDeveloper(req);
    const row = await this.clients.get(clientId);
    if (!row) throw new BadRequestException(`应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);

    if (!body?.password) throw new BadRequestException('请输入登录密码以验证身份');
    const ok = await this.devAuth.verifyPassword(dev.id, body.password);
    if (!ok) {
      await this.audit.logDeveloper(dev, 'developer.reveal_secret.failed', clientId, undefined, req.ip);
      throw new UnauthorizedException('登录密码不正确');
    }

    const secret = await this.clients.revealSecret(clientId);
    await this.audit.logDeveloper(dev, 'developer.reveal_secret', clientId, undefined, req.ip);
    return { data: { client_id: clientId, client_secret: secret } };
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateClientDto) {    const dev = currentDeveloper(req);
    // 实时查库校验开发者资格，不信任 JWT 里签发的旧状态
    await this.devAuth.assertDeveloperApproved(dev.id);
    const { client, secret } = await this.clients.create(dto, {
      developerId: dev.id,
      status: 'pending',
    });
    return { data: safeClient(client), client_id: client.client_id, client_secret: secret };
  }

  @Patch(':clientId')
  async update(
    @Req() req: Request,
    @Param('clientId') clientId: string,
    @Body()
    dto: {
      client_name?: string;
      redirect_uris?: string[];
      scope?: string;
      category?: 'web_app' | 'mobile_app' | 'mini_program';
      logo?: string;
      description?: string;
      website?: string;
      icp_number?: string;
      tags?: string[];
    },
  ) {
    const dev = currentDeveloper(req);
    await this.devAuth.assertDeveloperApproved(dev.id);
    const row = await this.clients.get(clientId);
    if (!row) throw new BadRequestException(`应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);
    if (row.status === 'pending') {
      throw new BadRequestException('应用正在审核中，暂不能修改');
    }
    const updated = await this.clients.update(clientId, dto, {
      revertToPending: true,
      developerId: dev.id,
    });
    return { data: safeClient(updated) };
  }
}
