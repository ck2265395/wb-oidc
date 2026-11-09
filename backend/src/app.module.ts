import { Module } from '@nestjs/common';
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
import { DeveloperAuthService } from './developer/developer-auth.service';
import { DeveloperGuard } from './developer/developer.guard';
import { DeveloperAuthController } from './developer/developer-auth.controller';
import { DeveloperAppsController } from './developer/developer-apps.controller';
import { AdminDevelopersController } from './developer/admin-developers.controller';

@Module({
  controllers: [
    ClientsController,
    AdminAuthController,
    AdminUsersController,
    HealthController,
    DeveloperAuthController,
    DeveloperAppsController,
    AdminDevelopersController,
    AdminOpsController,
  ],
  providers: [
    ClientsService,
    LegacyUserService,
    AdminAuthService,
    AdminAuthGuard,
    AdminAuditService,
    AdminUsersService,
    DeveloperAuthService,
    DeveloperGuard,
  ],
})
export class AppModule {}
