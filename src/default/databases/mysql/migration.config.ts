// src/database/typeorm.datasource.ts
import { DataSource } from "typeorm";
import { config } from "dotenv";

config({ path: `.env.${process.env.NODE_ENV || "development"}` });
const dbType = (process.env.DB_TYPE || "postgres") as "mysql" | "postgres";
const dbPrefix = dbType.toUpperCase();

export const AppDataSource = new DataSource({
  type: dbType,
  host: process.env[`${dbPrefix}_HOST`] || "localhost",
  port: Number(
    process.env[`${dbPrefix}_PORT`] || (dbType === "mysql" ? 3306 : 5432),
  ),
  username: process.env[`${dbPrefix}_USERNAME`] || "root",
  password: process.env[`${dbPrefix}_PASSWORD`] || "",
  database: process.env[`${dbPrefix}_DATABASE`] || "test",

  entities:
    dbType === "postgres"
      ? [
          __dirname + "/../../../modules/**/*.entity{.ts,.js}",
          __dirname + "/../../../modules/**/*.entities{.ts,.js}",
        ]
      : [__dirname + "/../../../default/common/entities/**/*.entity{.ts,.js}"],

  migrations:
    dbType === "postgres"
      ? [__dirname + "/../../../migrations/*.{ts,js}"]
      : [__dirname + "/../../../migrations/mysql/*.{ts,js}"],

  synchronize: false,
  logging: false,
  ...(dbType === "mysql" ? { charset: "utf8mb4" } : {}),
  timezone: "Z",
});
