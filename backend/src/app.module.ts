import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDataSource } from './db/data-source';
import { ClientsController } from './clients/clients.controller';
import { ClientsService } from './clients/clients.service';
import { LegacyUserService } from './oidc/legacy/legacy-user.service';
import { HealthController } from './health/health.controller';
import { AdminAuthController } from './admin/admin-auth.controller';
import { AdminAuthService } from './admin/admin-auth.service';
import { AdminAuthGuard } from './admin/admin-auth.guard';
import { AdminAuditService } from './admin/admin-audit.service';
import { AdminUsersController } from './admin/admin-users.controller';
import { AdminUsersService } from './admin/admin-users.service';
import { AdminOpsController } from './admin/admin-ops.controller';
import { AdminOpsService } from './admin/admin-ops.service';
import { DeveloperAuthService } from './developer/developer-auth.service';
import { DeveloperGuard } from './developer/developer.guard';
import { DeveloperAuthController } from './developer/developer-auth.controller';
import { DeveloperAppsController } from './developer/developer-apps.controller';
import { DeveloperApplyController } from './developer/developer-apply.controller';
import { AdminDevelopersController } from './developer/admin-developers.controller';
import { AdminDevelopersService } from './developer/admin-developers.service';

@Module({
  controllers: [
    ClientsController,
    AdminAuthController,
    AdminUsersController,
    HealthController,
    DeveloperAuthController,
    DeveloperAppsController,
    DeveloperApplyController,
    AdminDevelopersController,
    AdminOpsController,
  ],
  providers: [
    // 全局唯一 DataSource（启动前 main.ts 已 waitReady 完成建表/迁移）
    { provide: DataSource, useFactory: () => getDataSource() },
    ClientsService,
    LegacyUserService,
    AdminAuthService,
    AdminAuthGuard,
    AdminAuditService,
    AdminUsersService,
    AdminOpsService,
    DeveloperAuthService,
    AdminDevelopersService,
    DeveloperGuard,
  ],
})
export class AppModule {}
