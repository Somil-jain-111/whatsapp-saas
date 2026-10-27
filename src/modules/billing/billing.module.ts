import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import {
  BillingController,
  ReportsController,
  StripeWebhookController,
  RazorpayWebhookController,
  UsageController,
} from "./controllers/billing.controller";
import { StripeProvider } from "./providers/stripe.provider";
import { RazorpayProvider } from "./providers/razorpay.provider";
import { BillingRepository } from "./repositories/billing.repository";
import { BillingService } from "./services/billing.service";
import { EntitlementService } from "./services/entitlement.service";
import { PrivateObjectStorageModule } from "../storage/private-object-storage.module";
import {
  REPORT_EXPORT_QUEUE,
  ReportExportService,
} from "./services/report-export.service";
import { ReportExportProcessor } from "./services/report-export.processor";

@Module({
  imports: [
    DatabaseModule,
    PrivateObjectStorageModule,
    JwtModule.register({}),
    HttpModule,
    BullModule.registerQueue({ name: REPORT_EXPORT_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [
    BillingController,
    UsageController,
    ReportsController,
    StripeWebhookController,
    RazorpayWebhookController,
  ],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    BillingRepository,
    StripeProvider,
    RazorpayProvider,
    BillingService,
    EntitlementService,
    ReportExportService,
    ReportExportProcessor,
  ],
  exports: [BillingService, EntitlementService, ReportExportService],
})
export class BillingModule {}
