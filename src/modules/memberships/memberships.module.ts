import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { MembershipsRepository } from "./memberships.repository";

@Module({
  imports: [DatabaseModule],
  providers: [MembershipsRepository],
  exports: [MembershipsRepository],
})
export class MembershipsModule {}
