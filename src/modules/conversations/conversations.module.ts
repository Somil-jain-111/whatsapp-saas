import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { MessagingModule } from "../messaging/messaging.module";
import { SecurityModule } from "../security/security.module";
import { PrivateObjectStorageModule } from "../storage/private-object-storage.module";
import { RedisModule } from "../../default/databases/redis/redis.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { WhatsappIntegrationModule } from "../whatsapp-integration/whatsapp-integration.module";
import {
  ConversationsController,
  InboxController,
} from "./conversations.controller";
import { ConversationsRepository } from "./conversations.repository";
import { ConversationsService } from "./conversations.service";

@Module({
  imports: [
    DatabaseModule,
    MessagingModule,
    WhatsappIntegrationModule,
    SecurityModule,
    PrivateObjectStorageModule,
    RedisModule,
    AuditModule,
    JwtModule.register({}),
  ],
  controllers: [ConversationsController, InboxController],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    ConversationsRepository,
    ConversationsService,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
