import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { S3_QUEUE } from "./constants/s3-queue.constant";
import { S3UploadProcessor } from "./processors/s3-upload.processor";
import { S3Service } from "./s3.service";
import { S3Controller } from "./s3.controller";
import { R2Service } from "./r2.service";

@Module({
  imports: [
    ConfigModule,

    BullModule.registerQueueAsync({
      name: S3_QUEUE.UPLOAD,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const tlsEnabled =
          configService.get<boolean>("REDIS_TLS", false) === true;
        return {
          connection: {
            host: configService.get<string>("REDIS_HOST") || "localhost",
            port: Number(configService.get<string>("REDIS_PORT") || 6379),
            password: configService.get<string>("REDIS_PASSWORD") || undefined,
            ...(tlsEnabled ? { tls: {} } : {}),
          },
          // Hash tag keeps all of this queue's keys in one Redis Cluster slot,
          // avoiding CROSSSLOT on BullMQ's multi-key Lua scripts. Must match the
          // prefix used in BullmqModule.
          prefix: "{bull}",
        };
      },
    }),
  ],
  controllers: [S3Controller],
  providers: [S3Service, R2Service, S3UploadProcessor],
  exports: [S3Service, R2Service],
})
export class S3Module {}
