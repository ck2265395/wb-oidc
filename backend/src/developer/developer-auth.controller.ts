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
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperGuard, currentDeveloper } from './developer.guard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 开发者门户认证接口（/api/developer/auth/*）。
 * 与管理员会话完全独立：独立 cookie 名、独立 session 表、typ=developer_access。
 */
@Controller('developer/auth')
export class DeveloperAuthController {
  constructor(private readonly auth: DeveloperAuthService) {}

  private get cfg() {
    return loadConfig().adminAuth;
  }

  @Post('register')
  @HttpCode(200)
  async register(
    @Body()
    body: { email?: string; password?: string; company?: string; contact?: string },
    @Req() req: Request,
  ) {
    await this.auth.register(
      String(body?.email || ''),
      String(body?.password || ''),
      String(body?.company || ''),
      String(body?.contact || ''),
      req.ip,
    );
    return {
      ok: true,
      message: '注册成功，等待管理员审核，审核通过后即可登录提交应用',
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email?: string; password?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      String(body?.email || ''),
      String(body?.password || ''),
      req.ip,
      req.headers['user-agent'],
    );
    this.setRefreshCookie(res, result.refreshToken, result.refreshTtlSeconds);
    return {
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      developer: result.developer,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(this.readRefreshCookie(req), req.ip, req.headers['user-agent']);
    this.setRefreshCookie(res, result.refreshToken, result.refreshTtlSeconds);
    return {
      access_token: result.accessToken,
      expires_in: result.expiresIn,
      developer: result.developer,
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      await this.auth.logout(this.readRefreshCookie(req));
    } catch {
      /* 未登录登出，静默 */
    }
    res.clearCookie(this.cfg.cookieName + '_dev', this.cookieOptions());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(DeveloperGuard)
  async me(@Req() req: Request) {
    const dev = currentDeveloper(req);
    const row = await this.auth.me(dev.id);
    return {
      data: {
        id: row.id,
        email: row.email,
        company: row.company,
        contact: row.contact,
        status: row.status,
        reject_reason: row.reject_reason,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
      },
    };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.cfg.secureCookie,
      sameSite: 'lax' as const,
      path: '/api/developer/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string, maxAgeSeconds: number): void {
    res.cookie(this.cfg.cookieName + '_dev', token, {
      ...this.cookieOptions(),
      maxAge: maxAgeSeconds * 1000,
    });
  }

  private readRefreshCookie(req: Request): string {
    const header = req.headers.cookie || '';
    const name = this.cfg.cookieName + '_dev';
    for (const part of header.split(';')) {
      const [k, ...rest] = part.trim().split('=');
      if (k === name) return decodeURIComponent(rest.join('='));
    }
    throw new UnauthorizedException('缺少刷新令牌');
  }
}
