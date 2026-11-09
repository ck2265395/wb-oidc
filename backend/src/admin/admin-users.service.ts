import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { getPool } from '../db/pool';
import { AdminRow, AdminView, toAdminView } from './admin.types';

export interface CreateAdminDto {
  username?: string;
  password?: string;
  display_name?: string;
  role?: 'super_admin' | 'operator';
}

export interface UpdateAdminDto {
  display_name?: string;
  role?: 'super_admin' | 'operator';
  enabled?: boolean;
}

/**
 * 管理员账号管理（仅 super_admin 可调用，权限校验在控制器层）。
 * 密码永不外泄：查询统一走 oidc_admin 表但返回前转 AdminView。
 */
@Injectable()
export class AdminUsersService {
  private assertPassword(password: string): void {
    if (!password || password.length < 10) {
      throw new BadRequestException('密码至少 10 位');
    }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      throw new BadRequestException('密码需同时包含字母和数字');
    }
  }

  async list(): Promise<AdminView[]> {
    const { rows } = await getPool().query<AdminRow>(
      'SELECT * FROM oidc_admin ORDER BY created_at ASC',
    );
    return rows.map(toAdminView);
  }

  async create(dto: CreateAdminDto): Promise<AdminView> {
    const username = (dto.username || '').trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      throw new BadRequestException('用户名需 3-32 位字母/数字/_.-');
    }
    const password = dto.password || '';
    this.assertPassword(password);
    const role = dto.role === 'super_admin' ? 'super_admin' : 'operator';
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await getPool().query<AdminRow>(
        `INSERT INTO oidc_admin (username, password_hash, display_name, role)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [username, hash, (dto.display_name || username).slice(0, 64), role],
      );
      return toAdminView(rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException(`用户名 ${username} 已存在`);
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateAdminDto, operatorId: number): Promise<AdminView> {
    const current = await this.getRow(id);
    const nextRole = dto.role ?? current.role;
    const nextEnabled = dto.enabled ?? current.enabled;
    // 防止唯一超管自锁：不能停用自己，也不能把最后一个超管降级
    if (id === operatorId && (!nextEnabled || nextRole !== 'super_admin')) {
      throw new BadRequestException('不能停用自己或降低自己的角色');
    }
    if (current.role === 'super_admin' && nextRole !== 'super_admin') {
      const { rows } = await getPool().query<{ n: number }>(
        "SELECT COUNT(*)::int AS n FROM oidc_admin WHERE role = 'super_admin' AND enabled = TRUE",
      );
      if (rows[0].n <= 1) throw new BadRequestException('系统至少需要保留一个启用的超级管理员');
    }
    const { rows } = await getPool().query<AdminRow>(
      `UPDATE oidc_admin
          SET display_name = $2, role = $3, enabled = $4, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [id, (dto.display_name ?? current.display_name).slice(0, 64), nextRole, nextEnabled],
    );
    return toAdminView(rows[0]);
  }

  async resetPassword(id: number, password: string): Promise<void> {
    this.assertPassword(password);
    const hash = await bcrypt.hash(password, 10);
    const result = await getPool().query(
      'UPDATE oidc_admin SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [id, hash],
    );
    if (!result.rowCount) throw new NotFoundException('管理员不存在');
    // 改密后吊销该管理员所有刷新令牌，强制重新登录
    await getPool().query(
      'UPDATE oidc_admin_session SET revoked_at = NOW() WHERE admin_id = $1 AND revoked_at IS NULL',
      [id],
    );
  }

  private async getRow(id: number): Promise<AdminRow> {
    const { rows } = await getPool().query<AdminRow>(
      'SELECT * FROM oidc_admin WHERE id = $1 LIMIT 1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('管理员不存在');
    return rows[0];
  }
}
