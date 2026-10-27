import {
  ApiControllerDocs,
  ApiEndpoint,
} from "src/default/swagger/swagger.decorators";
import { Controller, Get, Res } from "@nestjs/common";
import { DataSource } from "typeorm";
import { RedisService } from "./default/databases/redis/redis.service";
import { CacheService } from "./default/cache/cache.service";
import { NoCache } from "./default/cache/cache.decorator";
import { AppConfigService } from "./default/config/config.service";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { Response } from "express";
import { ConsoleLogger } from "./default/logger/console/console.service";
import { DataSanitizer } from "./default/common/utils/sanitize.utils";

@ApiControllerDocs("Health", false)
@Controller()
export class AppController {
  constructor(
    private readonly sqlDbDataSource: DataSource,
    // @InjectDataSource("mongodbConnection")
    // private readonly mongoConnection: DataSource,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
    private readonly appConfigService: AppConfigService,
    private readonly httpService: HttpService,
  ) {}

  @NoCache()
  @ApiEndpoint("Get hello", false)
  @Get("")
  getHello() {
    return DataSanitizer.sanitizeData({
      message: "Response from base route - Hello World!",
    });
  }

  @NoCache()
  @ApiEndpoint("Check health", false)
  @Get("/health")
  async checkHealth(@Res() res: Response) {
    const response = await this.checkHealthService();
    res.status(response.statusCode).json(DataSanitizer.sanitizeData(response));
  }

  @NoCache()
  @ApiEndpoint("Prometheus process metrics", false)
  @Get("/metrics")
  metrics(@Res() res: Response) {
    const memory = process.memoryUsage();
    res.type("text/plain; version=0.0.4").send(
      [
        "# HELP relay_process_uptime_seconds Process uptime in seconds.",
        "# TYPE relay_process_uptime_seconds gauge",
        `relay_process_uptime_seconds ${process.uptime()}`,
        "# HELP relay_process_resident_memory_bytes Resident memory in bytes.",
        "# TYPE relay_process_resident_memory_bytes gauge",
        `relay_process_resident_memory_bytes ${memory.rss}`,
        "# HELP relay_node_heap_used_bytes Node.js heap used in bytes.",
        "# TYPE relay_node_heap_used_bytes gauge",
        `relay_node_heap_used_bytes ${memory.heapUsed}`,
        "",
      ].join("\n"),
    );
  }

  @NoCache()
  @ApiEndpoint("Check liveness", false)
  @Get("/health/live")
  liveness() {
    return { status: "ok" };
  }

  @NoCache()
  @ApiEndpoint("Check readiness", false)
  @Get("/health/ready")
  async readiness(@Res() res: Response) {
    const response = await this.checkHealthService(false);
    res.status(response.statusCode).json(DataSanitizer.sanitizeData(response));
  }

  public async checkHealthService(includeApplicationChecks = true) {
    ConsoleLogger.log("Health Check Triggered", "AppController");

    // Check individual services
    const databaseStatus = await this.checkDatabase();
    // const mongodbStatus = await this.checkMongoDB();
    const redisStatus = await this.checkRedis();
    const cacheServiceStatus = await this.cacheService.testCache();
    const swaggerStatus = includeApplicationChecks
      ? await this.checkSwagger()
      : undefined;

    // Create health object with 0 or 1 values
    const health = [
      { serviceName: "database", serviceStatus: databaseStatus },
      // { serviceName: "mongodb", serviceStatus: mongodbStatus },
      { serviceName: "redis", serviceStatus: redisStatus },
      { serviceName: "cacheService", serviceStatus: cacheServiceStatus },
      ...(includeApplicationChecks
        ? [{ serviceName: "swagger", serviceStatus: swaggerStatus! }]
        : []),
    ];

    // Generate boolean number as a string (e.g., "11001")
    const booleanNumber = health
      .map((service) => service.serviceStatus)
      .join("");

    // Convert boolean number to integer
    const healthCode = parseInt(booleanNumber, 2);
    const expectedHealthCode = parseInt("1".repeat(health.length), 2);

    const healthScore = `${health.length}.${healthCode}`;

    return {
      statusCode: healthCode === expectedHealthCode ? 200 : 503,
      healthScore: parseFloat(healthScore),
      failedServices: health
        .filter((s) => s.serviceStatus === 0)
        .map((s) => s.serviceName),
    };
  }

  private async checkDatabase(): Promise<number> {
    try {
      if (this.sqlDbDataSource.isInitialized) {
        await this.sqlDbDataSource.query("SELECT 1");
        return 1;
      }
      return 0;
    } catch (error) {
      ConsoleLogger.error("Database Health Check Error:", error);
      return 0;
    }
  }

  // private async checkMongoDB(): Promise<number> {
  //   try {
  //     const isConnected = this.mongoConnection.isInitialized;
  //     return isConnected ? 1 : 0;
  //   } catch (error) {
  //     ConsoleLogger.error("MongoDB Health Check Error:", error);
  //     return 0;
  //   }
  // }

  private async checkRedis(): Promise<number> {
    try {
      await this.redisService.set("health_check", "redis_ok", 1);
      const value = await this.redisService.get("health_check");
      return value === "redis_ok" ? 1 : 0;
    } catch (error) {
      ConsoleLogger.error("Redis Health Check Error:", error);
      return 0;
    }
  }

  private async checkSwagger(): Promise<number> {
    try {
      const swaggerPath = this.appConfigService.get("SWAGGER_PATH") || "docs";
      const baseUrl = `http://localhost:${this.appConfigService.getPort()}`;
      const swaggerUrl = `${baseUrl}/${swaggerPath}`;
      const response = await lastValueFrom(
        this.httpService.get(swaggerUrl, { timeout: 2000 }),
      );
      return response.status === 200 ? 1 : 0;
    } catch (error) {
      ConsoleLogger.error("Swagger Health Check Error:", error.message);
      return 0;
    }
  }
}
