import {
  Body,
  Controller,
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
import { ClientsService, CreateClientDto, ClientRow } from '../clients/clients.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';
import { DeveloperAuthService } from './developer-auth.service';
import { AdminAuditService } from '../admin/admin-audit.service';
import {
  ClientCreateRes,
  ClientItemRes,
  ClientListRes,
  ClientSecretRes,
  CreateClientBody,
  UpdateClientBody,
} from '../clients/clients.dto';
import { DevRevealSecretBody } from './developer.dto';
import { BizException } from '../common/biz.exception';
import { ERROR_CODE } from '../common/error-code';

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
@ApiTags('开发者-应用')
@ApiBearerAuth('bearer')
@UseGuards(DeveloperGuard)
@Controller('developer/apps')
export class DeveloperAppsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly devAuth: DeveloperAuthService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '我的应用列表', description: '返回当前开发者的全部应用，不含 client_secret' })
  @ApiOkResponse({ type: ClientListRes })
  async listMine(@Req() req: Request) {
    const dev = currentDeveloper(req);
    const rows = await this.clients.listByDeveloper(dev.id);
    return { data: rows.map(safeClient) };
  }

  @Get(':clientId')
  @ApiOperation({ summary: '应用详情', description: '仅限本人的应用；不含 client_secret' })
  @ApiOkResponse({ type: ClientItemRes })
  async getOne(@Req() req: Request, @Param('clientId') clientId: string) {
    const dev = currentDeveloper(req);
    const row = await this.clients.get(clientId);
    if (!row) throw new BizException(ERROR_CODE.APP_NOT_FOUND, `应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);
    return { data: safeClient(row) };
  }

  /**
   * 查看 client_secret 明文。
   * 需要重新输入登录密码做二次验证，且每次查看（成功/失败）都写审计日志。
   * 移动应用 / 小程序走 PKCE 没有 secret，返回 client_secret: null。
   */
  @Post(':clientId/reveal-secret')
  @ApiOperation({
    summary: '查看 client_secret 明文',
    description: '需输入登录密码二次验证；PKCE 类目（移动/小程序）没有 secret，返回 null；每次查看均写审计日志',
  })
  @ApiOkResponse({ type: ClientSecretRes })
  async revealSecret(
    @Req() req: Request,
    @Param('clientId') clientId: string,
    @Body() body: DevRevealSecretBody,
  ) {
    const dev = currentDeveloper(req);
    const row = await this.clients.get(clientId);
    if (!row) throw new BizException(ERROR_CODE.APP_NOT_FOUND, `应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);

    if (!body?.password) throw new BizException(ERROR_CODE.PARAM_INVALID, '请输入登录密码以验证身份');
    const ok = await this.devAuth.verifyPassword(dev.id, body.password);
    if (!ok) {
      await this.audit.logDeveloper(dev, 'developer.reveal_secret.failed', clientId, undefined, req.ip);
      throw new BizException(ERROR_CODE.AUTH_PASSWORD_INCORRECT, '登录密码不正确');
    }

    const secret = await this.clients.revealSecret(clientId);
    await this.audit.logDeveloper(dev, 'developer.reveal_secret', clientId, undefined, req.ip);
    return { data: { client_id: clientId, client_secret: secret } };
  }

  @Post()
  @ApiOperation({
    summary: '创建应用',
    description: '需开发者资格已通过；创建后为 pending 待审核；企业开发者必填 icp_number；client_secret 明文仅此次返回（PKCE 类目为空）',
  })
  @ApiOkResponse({ type: ClientCreateRes })
  async create(@Req() req: Request, @Body() dto: CreateClientBody) {    const dev = currentDeveloper(req);
    // 实时查库校验开发者资格，不信任 JWT 里签发的旧状态
    await this.devAuth.assertDeveloperApproved(dev.id);
    const { client, secret } = await this.clients.create(dto as CreateClientDto, {
      developerId: dev.id,
      status: 'pending',
    });
    return { data: safeClient(client), client_id: client.client_id, client_secret: secret };
  }

  @Patch(':clientId')
  @ApiOperation({
    summary: '编辑应用',
    description: '审核中（pending）不可修改；改动回调地址或 scope 会回到 pending 重新审核；需开发者资格已通过',
  })
  @ApiOkResponse({ type: ClientItemRes })
  async update(
    @Req() req: Request,
    @Param('clientId') clientId: string,
    @Body()
    dto: UpdateClientBody,
  ) {
    const dev = currentDeveloper(req);
    await this.devAuth.assertDeveloperApproved(dev.id);
    const row = await this.clients.get(clientId);
    if (!row) throw new BizException(ERROR_CODE.APP_NOT_FOUND, `应用 ${clientId} 不存在`);
    this.clients.assertOwned(row, dev.id);
    if (row.status === 'pending') {
      throw new BizException(ERROR_CODE.APP_UNDER_REVIEW);
    }
    const updated = await this.clients.update(clientId, dto, {
      revertToPending: true,
      developerId: dev.id,
    });
    return { data: safeClient(updated) };
  }
}
