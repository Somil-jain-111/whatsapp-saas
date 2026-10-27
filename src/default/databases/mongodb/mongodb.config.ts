import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";

export const mongoConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const mongoPort = configService.get("MONGO_PORT");

  const mongoUrl = mongoPort
    ? `mongodb://${configService.get("MONGO_USERNAME")}:${configService.get(
        "MONGO_PASSWORD",
      )}@${configService.get("MONGO_HOST")}:${mongoPort}/${configService.get(
        "MONGO_DATABASE",
      )}?authSource=admin`
    : `mongodb+srv://${configService.get("MONGO_USERNAME")}:${configService.get(
        "MONGO_PASSWORD",
      )}@${configService.get("MONGO_HOST")}/${configService.get("MONGO_DATABASE")}`;

  return {
    type: "mongodb",
    url: mongoUrl,
    // useUnifiedTopology: true,
    entities: [__dirname + "/../**/*.entity{.nosql.ts,.nosql.js}"],
    synchronize: configService.get("NODE_ENV") !== "production",
    logging: true,
  };
};
