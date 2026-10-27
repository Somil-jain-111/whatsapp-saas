import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { PlatformAdminRepository } from "./platform-admin.repository";
import { JwtModule } from "@nestjs/jwt";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";
import { PlatformAdminController } from "./platform-admin.controller";
import { BullModule } from "@nestjs/bullmq";
import { CONTACT_IMPORT_QUEUE } from "../contacts/contact-import.service";
import { WHATSAPP_SEND_QUEUE } from "../messaging/messaging.service";
import { META_WEBHOOK_QUEUE } from "../whatsapp-integration/services/meta-webhook.processor";
import { REPORT_EXPORT_QUEUE } from "../billing/services/report-export.service";
import { WORKFLOW_QUEUE } from "../automations/automations.service";
import { DEVELOPER_WEBHOOK_QUEUE } from "../developer-portal/developer-webhook.service";

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({}),
    BullModule.registerQueue(
      { name: CONTACT_IMPORT_QUEUE, prefix: "{bull}" },
      { name: WHATSAPP_SEND_QUEUE, prefix: "{bull}" },
      { name: META_WEBHOOK_QUEUE, prefix: "{bull}" },
      { name: REPORT_EXPORT_QUEUE, prefix: "{bull}" },
      { name: WORKFLOW_QUEUE, prefix: "{bull}" },
      { name: DEVELOPER_WEBHOOK_QUEUE, prefix: "{bull}" },
    ),
  ],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminRepository,
    PlatformAdminService,
    PhaseOneAuthGuard,
    PlatformAdminGuard,
  ],
  exports: [PlatformAdminRepository, PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
