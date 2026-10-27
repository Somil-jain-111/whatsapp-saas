import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "../../default/databases/redis/redis.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuditModule } from "../audit/audit.module";
import { CampaignsModule } from "../campaigns/campaigns.module";
import { DatabaseModule } from "../database/database.module";
import { MessagingModule } from "../messaging/messaging.module";
import { SecurityModule } from "../security/security.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { WhatsappIntegrationModule } from "../whatsapp-integration/whatsapp-integration.module";
import { ApiKeyService } from "./api-key.service";
import { DeveloperController } from "./developer.controller";
import { DeveloperDocumentationService } from "./developer-documentation.service";
import { DeveloperPortalRepository } from "./developer-portal.repository";
import { DeveloperPortalService } from "./developer-portal.service";
import { DeveloperWebhookController } from "./developer-webhook.controller";
import { DeveloperWebhookProcessor } from "./developer-webhook.processor";
import {
  DEVELOPER_WEBHOOK_QUEUE,
  DeveloperWebhookService,
} from "./developer-webhook.service";
import { PublicApiController } from "./public-api.controller";
import { PublicApiGuard } from "./public-api.guard";
import { PublicApiLogInterceptor } from "./public-api-log.interceptor";
import { PublicApiService } from "./public-api.service";
import { WebhookDestinationPolicy } from "./webhook-destination.policy";
import { OAuthTokenController } from "./oauth-token.controller";
import { OAuthTokenService } from "./oauth-token.service";
import { ApiSpendingService } from "./api-spending.service";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    SecurityModule,
    RedisModule,
    MessagingModule,
    CampaignsModule,
    AnalyticsModule,
    WhatsappIntegrationModule,
    HttpModule,
    JwtModule.register({}),
    BullModule.registerQueue({
      name: DEVELOPER_WEBHOOK_QUEUE,
      prefix: "{bull}",
    }),
  ],
  controllers: [
    DeveloperController,
    DeveloperWebhookController,
    PublicApiController,
    OAuthTokenController,
  ],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    DeveloperPortalRepository,
    DeveloperPortalService,
    ApiKeyService,
    PublicApiGuard,
    PublicApiLogInterceptor,
    PublicApiService,
    OAuthTokenService,
    ApiSpendingService,
    DeveloperDocumentationService,
    WebhookDestinationPolicy,
    DeveloperWebhookService,
    DeveloperWebhookProcessor,
  ],
  exports: [WebhookDestinationPolicy],
})
export class DeveloperPortalModule {}
