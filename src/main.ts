import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { readFileSync } from "fs";
import { config as loadEnvironment } from "dotenv";
import { RequestMethod } from "@nestjs/common";
import { AppModule } from "./app.module";
import { AppConfigService } from "./default/config/config.service";
import { AppController } from "./app.controller";
import { SwaggerService } from "./default/swagger/swagger.service";
import { ConsoleLogger } from "./default/logger/console/console.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";

import helmet from "helmet";
import cookieParser from "cookie-parser";
import { CommonUtils } from "./default/common/utils/common.utils";
import { applyNoCacheHeaders } from "./default/cache/cache.interceptor";
// import { RepositoryFactory } from "./default/common/repositories/RepositoryFactory";

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV || "development";
  loadEnvironment({ path: [`.env.${nodeEnv}`, ".env"] });
  const tlsPaths = [
    process.env.TLS_CERT_PATH,
    process.env.TLS_KEY_PATH,
    process.env.MTLS_CA_PATH,
  ];
  if (tlsPaths.some(Boolean) && !tlsPaths.every(Boolean))
    throw new Error(
      "TLS_CERT_PATH, TLS_KEY_PATH and MTLS_CA_PATH must be configured together",
    );
  const httpsOptions = tlsPaths.every(Boolean)
    ? {
        cert: readFileSync(process.env.TLS_CERT_PATH!),
        key: readFileSync(process.env.TLS_KEY_PATH!),
        ca: readFileSync(process.env.MTLS_CA_PATH!),
        requestCert: true,
        rejectUnauthorized: false,
      }
    : undefined;
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    httpsOptions,
  });
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  const appConfigService = app.get(AppConfigService);
  const port = appConfigService.getPort();
  const protocol = appConfigService.get("PROTOCOL") || "http";
  const host = appConfigService.get("HOST") || "localhost";
  const globalPrefix = `api/v${appConfigService.get("API_VERSION")}`;
  const payloadLimit = configService.get<string>("PAYLOAD_LIMIT", "1mb");
  app.use((_request: unknown, response: any, next: () => void) => {
    applyNoCacheHeaders(response);
    next();
  });
  app.useBodyParser("json", { limit: payloadLimit });
  app.useBodyParser("urlencoded", { limit: payloadLimit, extended: true });

  // Swagger UI is set up by SwaggerService below (gated to non-production there).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`, "unpkg.com"],
          styleSrc: [
            `'self'`,
            `'unsafe-inline'`,
            "cdn.jsdelivr.net",
            "fonts.googleapis.com",
            "unpkg.com",
          ],
          fontSrc: [`'self'`, "fonts.gstatic.com", "data:"],
          imgSrc: [`'self'`, "data:", "cdn.jsdelivr.net"],
          scriptSrc: [`'self'`, "cdn.jsdelivr.net"],
        },
      }, // or false
    }),
  );

  // Refresh authentication uses a Secure HttpOnly cookie. Explicit origins are
  // required because credentialed CORS must never use a wildcard.
  const allowedOrigins = String(
    configService.get<string>("CORS_ALLOWED_ORIGINS", ""),
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    methods: "GET,HEAD,POST,PATCH,DELETE,OPTIONS",
    credentials: true,
  });

  // Enable Cookie Parser
  app.use(cookieParser());

  // CSRF Protection
  // app.use(csurf({ cookie: true })); // Use cookies to store CSRF tokens

  // Global validation is registered via APP_PIPE in AppModule.

  const expressApp = app.getHttpAdapter().getInstance();
  if (appConfigService.isProduction()) expressApp.set("trust proxy", 1);
  expressApp.get("/", (req: any, res: any) => {
    res.json("Relay WhatsApp SaaS API");
  });

  // Enable api versioning with a prefix
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      { path: "webhooks/meta", method: RequestMethod.ALL },
      { path: "webhooks/payments/stripe", method: RequestMethod.ALL },
      { path: "webhooks/payments/razorpay", method: RequestMethod.ALL },
      { path: "internal/admin/v1/(.*)", method: RequestMethod.ALL },
      { path: "public/v1/(.*)", method: RequestMethod.ALL },
      { path: "public/oauth/token", method: RequestMethod.ALL },
    ],
  });

  // Initialize ConsoleLogger
  const eventEmitter = app.get(EventEmitter2);
  ConsoleLogger.initialize(eventEmitter);
  ConsoleLogger.log("Application initialized", "Bootstrap");

  // swagger service
  const swaggerService = app.get(SwaggerService);
  swaggerService.initialize(app);
  swaggerService.setupSwagger();

  // const dataSource = app.get(DataSource);

  // // ✅ Initialize RepositoryFactory with named connection
  // RepositoryFactory.init(dataSource);
  // ConsoleLogger.log(
  //   `✅ RepositoryFactory initialized with ${RepositoryFactory.listKeys().length} repositories`,
  //   "Bootstrap",
  // );
  // console.log("portttttt",port)
  CommonUtils.init(appConfigService);

  await app.listen(port, "0.0.0.0");

  const baseUrl = `${protocol}://${host}:${port}/${globalPrefix}`;

  ConsoleLogger.log(`Application is running on: ${baseUrl}`, "Bootstrap");
  ConsoleLogger.log(
    `Health Check Endpoint: ${baseUrl}/health/ready`,
    "Bootstrap",
  );
  ConsoleLogger.log("Initiating Launch Time Health Check", "Bootstrap");

  try {
    const appController = app.get(AppController); // ✅ Proper DI resolution
    const response = await appController.checkHealthService();
    ConsoleLogger.log(response, "Bootstrap");
  } catch (error) {
    ConsoleLogger.error(
      "Health Check Error",
      error?.stack || error,
      "Bootstrap",
    );
  }
}
bootstrap().catch((error) => {
  console.error("Fatal error during application bootstrap:", error);
  process.exit(1);
});
