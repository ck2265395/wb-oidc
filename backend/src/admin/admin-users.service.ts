import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DataSource, IsNull } from 'typeorm';
import { OidcAdmin, OidcAdminSession } from '../db/entities';
import { assertPasswordStrength } from './admin-password.util';
import { AdminView, toAdminView } from './admin.types';

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
 * 密码永不外泄：统一返回前转 AdminView。
 */
@Injectable()
export class AdminUsersService {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  private get repo() {
    return this.ds.getRepository(OidcAdmin);
  }

  async list(): Promise<AdminView[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map(toAdminView);
  }

  async create(dto: CreateAdminDto): Promise<AdminView> {
    const username = (dto.username || '').trim();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
      throw new BadRequestException('用户名需 3-32 位字母/数字/_.-');
    }
    const password = dto.password || '';
    assertPasswordStrength(password, username);
    const role = dto.role === 'super_admin' ? 'super_admin' : 'operator';
    const hash = await bcrypt.hash(password, 10);
    try {
      const row = await this.repo.save(
        this.repo.create({
          username,
          passwordHash: hash,
          displayName: (dto.display_name || username).slice(0, 64),
          role,
        }),
      );
      return toAdminView(row);
    } catch (err) {
      throw this.wrapUniqueViolation(err, `用户名 ${username} 已存在`);
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
      const activeSuper = await this.repo.count({
        where: { role: 'super_admin', enabled: true },
      });
      if (activeSuper <= 1) throw new BadRequestException('系统至少需要保留一个启用的超级管理员');
    }
    await this.repo.update(
      { id },
      {
        displayName: (dto.display_name ?? current.displayName).slice(0, 64),
        role: nextRole,
        enabled: nextEnabled,
      },
    );
    return toAdminView(await this.getRow(id));
  }

  async resetPassword(id: number, password: string): Promise<void> {
    const current = await this.getRow(id);
    assertPasswordStrength(password, current.username);
    const hash = await bcrypt.hash(password, 10);
    // 改密 + 吊销全部刷新令牌原子完成，强制重新登录
    await this.ds.transaction(async (em) => {
      await em.getRepository(OidcAdmin).update({ id }, { passwordHash: hash });
      await em
        .getRepository(OidcAdminSession)
        .update({ adminId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
    });
  }

  private async getRow(id: number): Promise<OidcAdmin> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('管理员不存在');
    return row;
  }

  /** PG 唯一约束冲突 → 409（TypeORM 会把驱动错误包一层，需取 driverError.code） */
  private wrapUniqueViolation(err: unknown, message: string): unknown {
    const e = err as { code?: string; driverError?: { code?: string } };
    if (e?.code === '23505' || e?.driverError?.code === '23505') {
      return new ConflictException(message);
    }
    return err;
  }
}
