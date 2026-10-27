import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { DatabaseModule } from "../database/database.module";
import { DeveloperPortalModule } from "../developer-portal/developer-portal.module";
import { PlatformAdminModule } from "../platform-admin/platform-admin.module";
import { SecurityModule } from "../security/security.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import {
  AutomationsAdminController,
  AutomationsController,
  ChatbotRulesController,
  WorkflowExecutionsController,
  WorkflowsController,
} from "./automations.controller";
import { AutomationsRepository } from "./automations.repository";
import { AutomationsService, WORKFLOW_QUEUE } from "./automations.service";
import { ConditionEvaluator, WorkflowValidator } from "./workflow.validator";
import { WorkflowEngineService } from "./workflow-engine.service";
import { WorkflowProcessor } from "./workflow.processor";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    SecurityModule,
    ConversationsModule,
    DeveloperPortalModule,
    PlatformAdminModule,
    HttpModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: WORKFLOW_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [
    WorkflowsController,
    WorkflowExecutionsController,
    ChatbotRulesController,
    AutomationsController,
    AutomationsAdminController,
  ],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    AutomationsRepository,
    WorkflowValidator,
    ConditionEvaluator,
    AutomationsService,
    WorkflowEngineService,
    WorkflowProcessor,
  ],
  exports: [AutomationsService],
})
export class AutomationsModule {}
