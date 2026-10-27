import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthenticationRepository } from "./authentication.repository";

@Module({
  imports: [DatabaseModule],
  providers: [AuthenticationRepository],
  exports: [AuthenticationRepository],
})
export class AuthenticationModule {}
