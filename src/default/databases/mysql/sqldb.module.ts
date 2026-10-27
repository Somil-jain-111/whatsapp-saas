import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { sqlDbConfig } from "./sqldb.config";
import { AppConfigService } from "../../config/config.service";
import { SqlDbService } from "./sqldb.service";
import { ConfigModule } from "../../config/config.module";
import { TransactionService } from "../transaction";

@Global()
@Module({
  imports: [
    ConfigModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: sqlDbConfig,
    }),
  ],
  providers: [SqlDbService, TransactionService],
  exports: [SqlDbService, TypeOrmModule, TransactionService], // 👈 export TypeOrmModule
})
export class SqlDbModule {}
