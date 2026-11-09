import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { loadConfig } from '../config/env';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminPrincipal } from './admin.types';

interface LoginDto {
  username?: string;
  password?: string;
}

/**
 * 管理端登录：账号密码 → 短时效 access token（body 返回，前端内存持有）
 * + refresh token（httpOnly cookie，路径限定在 /api/admin/auth，服务端可吊销）。
 */
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  private get cfg() {
    return loadConfig().adminAuth;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      String(body?.username || '').trim(),
      String(body?.password || ''),
      req.ip,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshTtlSeconds);
    return {
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      admin: result.admin,
    };
  }

  @Post('refresh')
  @HttpCode(200)
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
  async me(@CurrentAdmin() admin: AdminPrincipal) {
    return { data: await this.auth.me(admin.id) };
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
