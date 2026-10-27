import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { SessionsRepository } from "./sessions.repository";

@Module({
  imports: [DatabaseModule],
  providers: [SessionsRepository],
  exports: [SessionsRepository],
})
export class SessionsModule {}
