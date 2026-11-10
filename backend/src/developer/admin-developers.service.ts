import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { OidcDeveloper } from '../db/entities';

/**
 * 管理端用户 / 开发者管理（仅 super_admin 可写，权限校验在控制器层）。
 * 资格审核与账号启停的 SQL 在此，审计与会话吊销由控制器编排。
 */
@Injectable()
export class AdminDevelopersService {
  constructor(@Inject(DataSource) private readonly ds: DataSource) {}

  private get repo() {
    return this.ds.getRepository(OidcDeveloper);
  }

  async list(status?: string): Promise<OidcDeveloper[]> {
    const qb = this.repo.createQueryBuilder('d');
    // 资格筛选
    if (status && ['none', 'pending', 'approved', 'rejected'].includes(status)) {
      qb.where('d.developerStatus = :status', { status });
    } else if (status === 'suspended') {
      qb.where('d.status = :status', { status: 'suspended' });
    }
    qb.orderBy('COALESCE(d.developerAppliedAt, d.createdAt)', 'DESC').addOrderBy('d.createdAt', 'DESC');
    return qb.getMany();
  }

  /** 审核开发者资格申请：pending → approved / rejected */
  async review(
    id: number,
    next: 'approved' | 'rejected',
    reason: string,
  ): Promise<OidcDeveloper> {
    const result = await this.repo
      .createQueryBuilder()
      .update(OidcDeveloper)
      .set({ developerStatus: next, developerRejectReason: reason })
      .where('id = :id AND developer_status = :pending', { id, pending: 'pending' })
      .execute();
    if (!result.affected) {
      throw new BadRequestException('该用户没有待审核的开发者资格申请');
    }
    return this.getRow(id);
  }

  /** 账号启停（与开发者资格解耦） */
  async setStatus(
    id: number,
    next: 'active' | 'suspended',
    reason: string,
  ): Promise<OidcDeveloper> {
    const result = await this.repo.update(
      { id, status: In(['active', 'suspended']) },
      { status: next, rejectReason: reason },
    );
    if (!result.affected) throw new BadRequestException(`用户 ${id} 不存在`);
    return this.getRow(id);
  }

  private async getRow(id: number): Promise<OidcDeveloper> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new BadRequestException(`用户 ${id} 不存在`);
    return row;
  }
}
