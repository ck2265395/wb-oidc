import { BadRequestException } from '@nestjs/common';

/**
 * 管理端密码强度规则（新建账号、重置、自助修改共用）：
 * - 至少 10 位
 * - 同时包含字母和数字
 * - 不能与用户名相同
 */
export function assertPasswordStrength(password: string, username?: string): void {
  const pwd = password || '';
  if (pwd.length < 10) {
    throw new BadRequestException('密码至少 10 位');
  }
  if (pwd.length > 128) {
    throw new BadRequestException('密码不能超过 128 位');
  }
  if (!/[a-zA-Z]/.test(pwd) || !/\d/.test(pwd)) {
    throw new BadRequestException('密码需同时包含字母和数字');
  }
  if (username && pwd.toLowerCase() === username.toLowerCase()) {
    throw new BadRequestException('密码不能与用户名相同');
  }
}
