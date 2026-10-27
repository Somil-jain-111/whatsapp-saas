import { MiddlewareConsumer, Module, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "./default/config/config.module";
import { SqlDbModule } from "./default/databases/mysql/sqldb.module";
import { RedisModule } from "./default/databases/redis/redis.module";
import { AppController } from "./app.controller";
import { AppCacheModule } from "./default/cache/cache.module";
import { SwaggerModule } from "./default/swagger/swagger.module";
import { HttpModule } from "@nestjs/axios";
import { ErrorHandlingModule } from "./default/error/error.module";
import { NotFoundMiddleware } from "./default/common/middleware/not-found.middleware";
import { ValidationPipe, ValidationError } from "@nestjs/common";
import { BusinessException } from "./default/error/business.exception";
import { ERROR_CODES } from "./default/error/error.code";
import { ConsoleLogger } from "./default/logger/console/console.service";
import { ScheduleModule } from "@nestjs/schedule";
import { UnifiedResponseInterceptor } from "./default/common/interceptors/unified-response.interceptor";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { AppConfigService } from "./default/config/config.service";
import { LoggerModule } from "./default/logger/console/console.module";
import { CloudwatchModule } from "./default/logger/cloudwatch/cloudwatch.module";
import { BullmqModule } from "./default/common/services/bullmq/bullmq.module";
import { LocalStorageInterceptor } from "./default/common/interceptors/local-storage.interceptor";
import { IdempotencyModule } from "./default/idempotency/idempotency.module";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { JourneyIdMiddleware } from "./default/common/middleware/journey-id.middleware";
import { SellerApprovalWriteInterceptor } from "./default/common/interceptors/seller-approval-write.interceptor";
import { SellerWriteAccessService } from "./default/common/services/seller-write-access.service";
import { PhaseOneDataModule } from "./modules/phase-one-data.module";
import { WhatsappIntegrationModule } from "./modules/whatsapp-integration/whatsapp-integration.module";
import { BillingModule } from "./modules/billing/billing.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { CampaignsModule } from "./modules/campaigns/campaigns.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { PlatformAdminModule } from "./modules/platform-admin/platform-admin.module";
import { ApiUsageMeteringInterceptor } from "./modules/billing/services/api-usage-metering.interceptor";
import { IdentityModule } from "./modules/identity/identity.module";
import { DeveloperPortalModule } from "./modules/developer-portal/developer-portal.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { AutomationsModule } from "./modules/automations/automations.module";
import { EnterpriseModule } from "./modules/enterprise/enterprise.module";

import {
  firstValidationErrorMessage,
  flattenValidationErrors,
} from "./default/common/utils/validation-error.util";

const postgresModules =
  process.env.DB_TYPE === "postgres"
    ? [
        PhaseOneDataModule,
        WhatsappIntegrationModule,
        ContactsModule,
        MessagingModule,
        CampaignsModule,
        AnalyticsModule,
        BillingModule,
        PlatformAdminModule,
        IdentityModule,
        DeveloperPortalModule,
        ConversationsModule,
        AutomationsModule,
        EnterpriseModule,
      ]
    : [];

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 30,
      },
    ]),

    // Temporarily pause every @Cron/@Interval/@Timeout worker.
    ScheduleModule.forRoot({
      cronJobs: false,
      intervals: false,
      timeouts: false,
    }),
    EventEmitterModule.forRoot(),
    ConfigModule,
    LoggerModule,
    SqlDbModule,
    // MongodbModule,
    RedisModule,
    AppCacheModule,
    SwaggerModule,
    HttpModule,
    ErrorHandlingModule,
    CloudwatchModule,
    BullmqModule,
    IdempotencyModule,
    ...postgresModules,
    // OnboardingApprovalModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
          exceptionFactory: (errors: ValidationError[]) => {
            const validationErrors = flattenValidationErrors(errors);
            ConsoleLogger.error(
              "DTO validation failed",
              JSON.stringify(validationErrors),
              "ValidationPipe",
            );
            return new BusinessException(
              {
                ...ERROR_CODES.VALIDATION.VALIDATION_FAILED,
                message: firstValidationErrorMessage(validationErrors),
              },
              undefined,
              { errors: validationErrors },
            );
          },
        }),
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UnifiedResponseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LocalStorageInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SellerApprovalWriteInterceptor,
    },
    SellerWriteAccessService,
    AppConfigService,
    ...(process.env.DB_TYPE === "postgres"
      ? [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApiUsageMeteringInterceptor,
          },
        ]
      : []),
    // MediaService,
  ],
  controllers: [AppController],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NotFoundMiddleware, JourneyIdMiddleware)
      .exclude({ path: "/api/v1/users", method: RequestMethod.ALL })
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
