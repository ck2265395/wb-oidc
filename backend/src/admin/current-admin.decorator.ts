import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminPrincipal } from './admin.types';

/** 控制器里取当前登录管理员：@CurrentAdmin() admin */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminPrincipal => {
    const req = ctx.switchToHttp().getRequest();
    return req.admin as AdminPrincipal;
  },
);
