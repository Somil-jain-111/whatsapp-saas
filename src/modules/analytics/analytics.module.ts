import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsService } from "./analytics.service";
@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AnalyticsController],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    AnalyticsRepository,
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
