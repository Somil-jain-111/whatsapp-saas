import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { SecurityModule } from "../security/security.module";
import { AccountsController } from "./controllers/accounts.controller";
import { IntegrationHealthController } from "./controllers/integration-health.controller";
import { MetaController } from "./controllers/meta.controller";
import { MetaWebhookController } from "./controllers/meta-webhook.controller";
import { TemplatesController } from "./controllers/templates.controller";
import { PhaseOneAuthGuard } from "./guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "./guards/tenant-permission.guard";
import { MetaGraphProvider } from "./providers/meta-graph.provider";
import { WhatsappIntegrationRepository } from "./repositories/whatsapp-integration.repository";
import { AccountService } from "./services/account.service";
import { IntegrationHealthService } from "./services/integration-health.service";
import { MetaOnboardingService } from "./services/meta-onboarding.service";
import {
  META_WEBHOOK_QUEUE,
  MetaWebhookProcessor,
} from "./services/meta-webhook.processor";
import { MetaWebhookService } from "./services/meta-webhook.service";
import { TemplateService } from "./services/template.service";
import { TemplatePayloadValidator } from "./validators/template-payload.validator";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    SecurityModule,
    BillingModule,
    JwtModule.register({}),
    HttpModule,
    BullModule.registerQueue({ name: META_WEBHOOK_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [
    MetaController,
    AccountsController,
    TemplatesController,
    IntegrationHealthController,
    MetaWebhookController,
  ],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    WhatsappIntegrationRepository,
    MetaGraphProvider,
    MetaOnboardingService,
    AccountService,
    TemplateService,
    TemplatePayloadValidator,
    MetaWebhookService,
    MetaWebhookProcessor,
    IntegrationHealthService,
  ],
  exports: [MetaGraphProvider, WhatsappIntegrationRepository, TemplateService],
})
export class WhatsappIntegrationModule {}
