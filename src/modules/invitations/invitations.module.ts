import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { InvitationsRepository } from "./invitations.repository";

@Module({
  imports: [DatabaseModule],
  providers: [InvitationsRepository],
  exports: [InvitationsRepository],
})
export class InvitationsModule {}
