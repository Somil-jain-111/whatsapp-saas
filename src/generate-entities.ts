import { exec } from "child_process";
import { NestFactory } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { AppConfigService } from "./default/config/config.service";
import path from "path";
import chalk from "chalk";

async function generateEntities() {
  const app = await NestFactory.createApplicationContext({
    module: class RootModule {},
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [AppConfigService],
  });

  const apiConfigService = app.get(AppConfigService);

  const host = apiConfigService.get("MYSQL_HOST");
  const database = apiConfigService.get("MYSQL_DATABASE");
  const username = apiConfigService.get("MYSQL_USERNAME");
  const password = apiConfigService.get("MYSQL_PASSWORD");

  const dialect = "mysql";
  const outputDir = path.join(__dirname, "../default/common");

  const command = [
    "typeorm-model-generator",
    `-h ${host}`,
    `-d ${database}`,
    `-u ${username}`,
    `-x ${password}`,
    `-e ${dialect}`,
    `-o ${outputDir}`,
    "--no-config",
    "--ce pascal",
    "--cp camel",
  ].join(" ");

  exec(command, (error) => {
    if (error) {
      console.error(
        chalk.red(`❌ Error generating entities: ${error.message}`),
      );
      return;
    }
    app.close();
  });
}

generateEntities();
