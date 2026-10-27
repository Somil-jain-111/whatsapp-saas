import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ConsoleLogger } from "../../logger/console/console.service";
import { DataSource } from "typeorm";

@Injectable()
export class MongoService {
  constructor(
    @InjectDataSource("mongodbConnection")
    private readonly dataSource: DataSource,
  ) {}

  async findWithAggregation(pipeline: any[]): Promise<any[]> {
    ConsoleLogger.log("findWithAggregation");
    return this.dataSource.mongoManager
      .aggregate("collectionName", pipeline)
      .toArray();
  }
}
