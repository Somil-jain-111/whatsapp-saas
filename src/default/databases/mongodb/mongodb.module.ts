import { Module, OnModuleInit } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { mongoConfig } from "./mongodb.config";
import { AppConfigService } from "../../config/config.service";
import { MongoService } from "./mongodb.service";
import { ConfigModule } from "../../config/config.module";
import { ConsoleLogger } from "../../logger/console/console.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      name: "mongodbConnection",
      imports: [ConfigModule],
      useFactory: mongoConfig,
      inject: [AppConfigService],
    }),
  ],
  providers: [MongoService],
  exports: [MongoService],
})
export class MongodbModule implements OnModuleInit {
  async onModuleInit() {
    ConsoleLogger.log(
      "MongoDB Module: Connection established successfully!",
      "MongodbModule",
    );
  }
}
