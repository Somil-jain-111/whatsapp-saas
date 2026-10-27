import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import { TenantPermissionGuard } from "../whatsapp-integration/guards/tenant-permission.guard";
import { ContactsController } from "./contacts.controller";
import { ContactsRepository } from "./contacts.repository";
import { ContactsService } from "./contacts.service";
import { PrivateObjectStorageModule } from "../storage/private-object-storage.module";
import {
  CONTACT_IMPORT_QUEUE,
  ContactImportService,
} from "./contact-import.service";
import { ContactImportProcessor } from "./contact-import.processor";

@Module({
  imports: [
    DatabaseModule,
    PrivateObjectStorageModule,
    JwtModule.register({}),
    BullModule.registerQueue({ name: CONTACT_IMPORT_QUEUE, prefix: "{bull}" }),
  ],
  controllers: [ContactsController],
  providers: [
    PhaseOneAuthGuard,
    TenantPermissionGuard,
    ContactsRepository,
    ContactsService,
    ContactImportService,
    ContactImportProcessor,
  ],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
