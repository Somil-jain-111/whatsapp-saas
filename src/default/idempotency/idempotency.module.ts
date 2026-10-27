import { Module } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";
import { RedisModule } from "../databases/redis/redis.module";

@Module({
  imports: [RedisModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
