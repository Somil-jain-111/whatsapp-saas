// src/default/databases/redis/redis.module.ts
import { Module, OnModuleInit } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { ConfigModule } from "../../config/config.module";
import { ConsoleLogger } from "src/default/logger/console/console.service";
// import { ConsoleLogger } from '../../logger/console/console.service';

@Module({
  imports: [ConfigModule], // if you want to keep config module for other things
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule implements OnModuleInit {
  async onModuleInit() {
    ConsoleLogger.log(
      "Redis Module: Connection established successfully!",
      "RedisModule",
    );
  }
}
