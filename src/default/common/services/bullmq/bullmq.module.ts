import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { BullmqService } from "./bullmq.service";
import { BULLMQ_QUEUE } from "./bullmq.constants";
import { CloudwatchModule } from "../../../logger/cloudwatch/cloudwatch.module";
import { CloudwatchLogProcessor } from "./processors/cloudwatch-log.processor";
import { CloudwatchLogListener } from "./listeners/cloudwatch-log.listener";
import { RedisModule } from "src/default/databases/redis/redis.module";
import { RedisService } from "src/default/databases/redis/redis.service";

@Module({
  imports: [
    RedisModule,

    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        connection: redisService.getBullMqConnection() as any,
        // Redis Cluster hashes each key to a slot, but BullMQ's Lua scripts touch
        // ~11 keys per queue at once, which fails with CROSSSLOT unless they all
        // land in the same slot. The braces make Redis hash only "bull", so every
        // queue key shares one slot. Must match the prefix on every registerQueue.
        prefix: "{bull}",
      }),
    }),

    BullModule.registerQueue({
      name: BULLMQ_QUEUE.CLOUDWATCH_LOG,
      prefix: "{bull}",
    }),

    CloudwatchModule,
  ],
  providers: [BullmqService, CloudwatchLogProcessor, CloudwatchLogListener],
  exports: [BullmqService, BullModule],
})
export class BullmqModule {}
