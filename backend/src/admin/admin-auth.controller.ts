import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { loadConfig } from '../config/env';
import { clearRateLimit, hitRateLimit } from '../common/rate-limiter';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';
import {
  AdminChangePasswordBody,
  AdminLoginBody,
  AdminLoginRes,
  AdminUserItemRes,
} from './admin.dto';
import { MessageRes, OkRes } from '../common/api.dto';

/**
 * 管理端登录：账号密码 → 短时效 access token（body 返回，前端内存持有）
 * + refresh token（httpOnly cookie，路径限定在 /api/admin/auth，服务端可吊销）。
 */
@ApiTags('管理端-认证')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  private get cfg() {
    return loadConfig().adminAuth;
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '管理员登录', description: '同用户名+IP 限流防撞库；成功后 set httpOnly refresh cookie' })
  @ApiOkResponse({ type: AdminLoginRes })
  async login(
    @Body() body: AdminLoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 登录限流：同用户名+IP 窗口期内限次，防撞库（阈值见 RATE_LIMIT_LOGIN_MAX）
    const cfg = loadConfig().rateLimit;
    const loginKey = `adminlogin:${String(body?.username || '').trim()}:${req.ip}`;
    if (!hitRateLimit(loginKey, cfg.loginMax, cfg.loginWindowMs)) {
      throw new HttpException('登录尝试过于频繁，请稍后再试', 429);
    }
    const result = await this.auth.login(
      String(body?.username || '').trim(),
      String(body?.password || ''),
      req.ip,
      req.headers['user-agent'],
    );
    clearRateLimit(loginKey);
    this.setRefreshCookie(res, result.refreshToken, result.refreshTtlSeconds);
    return {
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      admin: result.admin,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: '刷新 access token', description: '凭 httpOnly cookie 中的 refresh token 换新，刷新即轮换' })
  @ApiOkResponse({ type: AdminLoginRes })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = this.readRefreshCookie(req);
    const result = await this.auth.refresh(raw, req.ip, req.headers['user-agent']);
    this.setRefreshCookie(res, result.refreshToken, result.refreshTtlSeconds);
    return {
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      admin: result.admin,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '管理员登出', description: '吊销 refresh token 并清 cookie；access token 过期也允许登出' })
  @ApiOkResponse({ type: OkRes })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = this.readRefreshCookie(req);
    let admin: AdminPrincipal | undefined;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        admin = this.auth.verifyAccess(header.slice(7).trim());
      } catch {
        // access token 过期也允许登出，仅吊销刷新令牌
      }
    }
    await this.auth.logout(raw, admin, req.ip);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '获取当前管理员信息' })
  @ApiOkResponse({ type: AdminUserItemRes })
  async me(@CurrentAdmin() admin: AdminPrincipal) {
    return { data: await this.auth.me(admin.id) };
  }

  /** 自助修改密码：校验原密码 → 更新 → 吊销全部会话 → 清 cookie */
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: '管理员自助修改密码', description: '校验原密码后更新，并吊销全部会话、清 refresh cookie，强制重新登录' })
  @ApiOkResponse({ type: MessageRes })
  async changePassword(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() body: AdminChangePasswordBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(
      admin,
      String(body?.old_password || ''),
      String(body?.new_password || ''),
      req.ip,
    );
    this.clearRefreshCookie(res);
    return { ok: true, message: '密码已修改，请使用新密码重新登录' };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.cfg.secureCookie,
      sameSite: 'lax' as const,
      path: '/api/admin/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string, maxAgeSeconds: number): void {
    res.cookie(this.cfg.cookieName, token, { ...this.cookieOptions(), maxAge: maxAgeSeconds * 1000 });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.cfg.cookieName, this.cookieOptions());
  }

  private readRefreshCookie(req: Request): string {
    const header = req.headers.cookie || '';
    const name = this.cfg.cookieName;
    for (const part of header.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return decodeURIComponent(rest.join('='));
    }
    throw new UnauthorizedException('缺少刷新令牌');
  }
}
