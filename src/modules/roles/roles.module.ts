import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { RolesRepository } from "./roles.repository";

@Module({
  imports: [DatabaseModule],
  providers: [RolesRepository],
  exports: [RolesRepository],
})
export class RolesModule {}
