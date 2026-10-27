import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { SecurityModule } from "../security/security.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { IdentityController, WorkspaceController } from "./identity.controller";
import { IdentityService } from "./identity.service";
import {
  IDENTITY_EMAIL_QUEUE,
  IdentityEmailProcessor,
  IdentityEmailService,
} from "./identity-email.service";

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: IDENTITY_EMAIL_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [IdentityController, WorkspaceController],
  providers: [
    IdentityService,
    IdentityEmailService,
    IdentityEmailProcessor,
    PhaseOneAuthGuard,
    TenantPermissionGuard,
  ],
  exports: [IdentityService],
})
export class IdentityModule {}
