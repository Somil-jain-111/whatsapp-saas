import { Injectable, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
// import { RepositoryFactory } from "../../common/repositories/RepositoryFactory";
import { ConsoleLogger } from "../../logger/console/console.service";

@Injectable()
export class SqlDbService implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource, // ✅ default connection
  ) {}

  async onModuleInit() {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
    } catch (error: any) {
      ConsoleLogger.error(
        "Failed to initialize RepositoryFactory",
        error?.stack,
        "SqlDbService",
      );
      throw error;
    }
  }
}
