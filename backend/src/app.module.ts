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

@Module({
  controllers: [ClientsController, AdminAuthController, AdminUsersController, HealthController],
  providers: [
    ClientsService,
    LegacyUserService,
    AdminAuthService,
    AdminAuthGuard,
    AdminAuditService,
    AdminUsersService,
  ],
})
export class AppModule {}
