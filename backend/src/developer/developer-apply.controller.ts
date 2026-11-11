import { Body, Controller, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';
import { DevApplyBody, DevApplyRes, DevUpdateProfileBody } from './developer.dto';

/**
 * 开发者资料与资格申请。
 * - PATCH /api/developer/profile：只更新资料，不改变资格状态
 * - POST  /api/developer/apply  ：补齐资料并提交资格审核，进入 pending
 */
@ApiTags('开发者-资料与资格')
@ApiBearerAuth('bearer')
@UseGuards(DeveloperGuard)
@Controller('developer')
export class DeveloperApplyController {
  constructor(private readonly auth: DeveloperAuthService) {}

  @Post('apply')
  @HttpCode(200)
  @ApiOperation({ summary: '申请开发者资格', description: '补齐资料并提交审核，资格进入 pending；需审核通过后才能创建应用' })
  @ApiOkResponse({ type: DevApplyRes })
  async apply(
    @Req() req: Request,
    @Body() body: DevApplyBody,
  ) {
    const dev = currentDeveloper(req);
    const row = await this.auth.applyDeveloper(
      dev.id,
      String(body?.company || ''),
      String(body?.contact || ''),
      body?.developer_type === 'enterprise' ? 'enterprise' : 'personal',
    );
    return {
      data: row,
      message: '资料已提交，等待管理员审核',
    };
  }

  /** 编辑资料：普通用户可先保存，已认证 / 审核中用户也可维护，不影响资格状态 */
  @Patch('profile')
  @HttpCode(200)
  @ApiOperation({ summary: '编辑开发者资料', description: '只更新资料不改变资格状态；已认证/审核中也可维护' })
  @ApiOkResponse({ type: DevApplyRes })
  async updateProfile(
    @Req() req: Request,
    @Body() body: DevUpdateProfileBody,
  ) {
    const dev = currentDeveloper(req);
    const row = await this.auth.updateProfile(
      dev.id,
      String(body?.company || ''),
      String(body?.contact || ''),
      body?.developer_type === 'enterprise' ? 'enterprise' : 'personal',
    );
    return {
      data: row,
      message: '资料已保存',
    };
  }
}
