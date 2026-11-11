import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DeveloperAuthService } from './developer-auth.service';
import { DeveloperPrincipal } from './developer.types';
import { BizException } from '../common/biz.exception';
import { ERROR_CODE } from '../common/error-code';

/** 开发者门户鉴权：仅接受 typ=developer_access 的 JWT */
@Injectable()
export class DeveloperGuard implements CanActivate {
  constructor(private readonly auth: DeveloperAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw new BizException(ERROR_CODE.UNAUTHORIZED, '缺少登录凭据');
    }
    const admin = this.auth.verifyAccess(header.slice(7).trim());
    (req as Request & { developer?: DeveloperPrincipal }).developer = admin;
    return true;
  }
}

/** 从请求上取当前开发者（配合 DeveloperGuard 使用） */
export function currentDeveloper(req: Request): DeveloperPrincipal {
  const dev = (req as Request & { developer?: DeveloperPrincipal }).developer;
  if (!dev) throw new BizException(ERROR_CODE.UNAUTHORIZED, '登录已失效');
  return dev;
}
