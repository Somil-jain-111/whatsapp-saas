import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { PermissionsRepository } from "./permissions.repository";

@Module({
  imports: [DatabaseModule],
  providers: [PermissionsRepository],
  exports: [PermissionsRepository],
})
export class PermissionsModule {}
