import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';
import { toDeveloperView } from './developer.types';

/**
 * 开发者资格申请（/api/developer/apply）。
 * 普通用户补齐公司与联系方式后提交，进入 pending 等待管理员审核。
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
}
