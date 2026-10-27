import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { BillingModule } from "../billing/billing.module";
import { SecurityModule } from "../security/security.module";
import { WhatsappIntegrationModule } from "../whatsapp-integration/whatsapp-integration.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { MessagingController } from "./messaging.controller";
import { MessagingProcessor } from "./messaging.processor";
import { MessagingRepository } from "./messaging.repository";
import { MessagingService, WHATSAPP_SEND_QUEUE } from "./messaging.service";
import { PrivateObjectStorageModule } from "../storage/private-object-storage.module";
@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    SecurityModule,
    WhatsappIntegrationModule,
    PrivateObjectStorageModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: WHATSAPP_SEND_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [MessagingController],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    MessagingRepository,
    MessagingService,
    MessagingProcessor,
  ],
  exports: [MessagingService],
})
export class MessagingModule {}
