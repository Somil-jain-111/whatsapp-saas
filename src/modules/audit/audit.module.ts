import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuditRepository } from "./audit.repository";

@Module({
  imports: [DatabaseModule],
  providers: [AuditRepository],
  exports: [AuditRepository],
})
export class AuditModule {}
