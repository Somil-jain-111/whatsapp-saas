import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { BillingModule } from "../billing/billing.module";
import { MessagingModule } from "../messaging/messaging.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import {
  BulkMessagesController,
  CampaignsController,
} from "./campaigns.controller";
import { CampaignsRepository } from "./campaigns.repository";
import { CampaignsService } from "./campaigns.service";
@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    MessagingModule,
    JwtModule.register({}),
  ],
  controllers: [CampaignsController, BulkMessagesController],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    CampaignsRepository,
    CampaignsService,
  ],
  exports: [CampaignsService, CampaignsRepository],
})
export class CampaignsModule {}
