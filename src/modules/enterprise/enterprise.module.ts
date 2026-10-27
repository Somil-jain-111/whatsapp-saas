import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BullModule } from "@nestjs/bullmq";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { DeveloperPortalModule } from "../developer-portal/developer-portal.module";
import { PlatformAdminGuard } from "../platform-admin/guards/platform-admin.guard";
import { PlatformAdminModule } from "../platform-admin/platform-admin.module";
import { SecurityModule } from "../security/security.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import {
  EnterpriseAdminController,
  EnterpriseController,
  PrivacyController,
} from "./enterprise.controller";
import { EnterpriseRepository } from "./enterprise.repository";
import { EnterpriseService } from "./enterprise.service";
import { RETENTION_QUEUE, RetentionProcessor } from "./retention.processor";

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    AuditModule,
    DeveloperPortalModule,
    JwtModule.register({}),
    PlatformAdminModule,
    BullModule.registerQueue({ name: RETENTION_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [
    EnterpriseController,
    PrivacyController,
    EnterpriseAdminController,
  ],
  providers: [
    EnterpriseRepository,
    EnterpriseService,
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    PlatformAdminGuard,
    RetentionProcessor,
  ],
  exports: [EnterpriseService],
})
export class EnterpriseModule {}
