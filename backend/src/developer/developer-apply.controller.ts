import { Body, Controller, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';
import { toDeveloperView } from './developer.types';

/**
 * 开发者资料与资格申请。
 * - PATCH /api/developer/profile：只更新资料，不改变资格状态
 * - POST  /api/developer/apply  ：补齐资料并提交资格审核，进入 pending
 */
@Controller('developer')
@UseGuards(DeveloperGuard)
export class DeveloperApplyController {
  constructor(private readonly auth: DeveloperAuthService) {}

  @Post('apply')
  @HttpCode(200)
  async apply(
    @Req() req: Request,
    @Body() body: { company?: string; contact?: string },
  ) {
    const dev = currentDeveloper(req);
    const row = await this.auth.applyDeveloper(
      dev.id,
      String(body?.company || ''),
      String(body?.contact || ''),
    );
    return {
      data: toDeveloperView(row),
      message: '资料已提交，等待管理员审核',
    };
  }

  /** 编辑资料：普通用户可先保存，已认证 / 审核中用户也可维护，不影响资格状态 */
  @Patch('profile')
  @HttpCode(200)
  async updateProfile(
    @Req() req: Request,
    @Body() body: { company?: string; contact?: string },
  ) {
    const dev = currentDeveloper(req);
    const row = await this.auth.updateProfile(
      dev.id,
      String(body?.company || ''),
      String(body?.contact || ''),
    );
    return {
      data: toDeveloperView(row),
      message: '资料已保存',
    };
  }
}
