import { INestApplication } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppConfigService } from "../config/config.service";
import { ConsoleLogger } from "../logger/console/console.service";
import { normalizeSwaggerResponses } from "./swagger-document.util";

@Injectable()
export class SwaggerService {
  private app?: INestApplication;
  private initialized = false;

  constructor(private readonly configService: AppConfigService) {}

  initialize(app: INestApplication) {
    this.app = app;
  }

  setupSwagger(): void {
    if (!this.app) {
      throw new Error("SwaggerService: Application instance is not set.");
    }

    if (this.configService.isProduction()) {
      ConsoleLogger.log(
        "Swagger setup skipped in production",
        "SwaggerService",
      );
      return;
    }

    if (!this.configService.get<boolean>("SWAGGER_ENABLED", true)) {
      ConsoleLogger.log(
        "Swagger setup disabled by configuration",
        "SwaggerService",
      );
      return;
    }

    if (this.initialized) {
      return;
    }

    // Load environment variables for Swagger
    const appName = this.configService.get("APP_NAME") || "Fashion E-Commerce";
    const apiVersion = this.configService.get("API_VERSION") || "1";
    const swaggerTitle = `${appName} API`;
    const swaggerDescription = `Complete API documentation for ${appName} Platform`;
    const swaggerVersion = `${apiVersion}.0`;
    const swaggerPath = this.configService.get("SWAGGER_PATH") || "docs";

    const config = new DocumentBuilder()
      .setTitle(swaggerTitle)
      .setDescription(swaggerDescription)
      .setVersion(swaggerVersion)
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "Authorization",
          in: "header",
          description:
            "Enter the access token returned by the appropriate login API.",
        },
        "access-token",
      )
      .build();

    const document = SwaggerModule.createDocument(this.app, config, {
      deepScanRoutes: true,
      autoTagControllers: true,
      operationIdFactory: (controllerKey: string, methodKey: string) =>
        `${controllerKey.replace(/Controller$/, "")}_${methodKey}`,
    });
    normalizeSwaggerResponses(document);

    SwaggerModule.setup(swaggerPath, this.app, document, {
      jsonDocumentUrl: `${swaggerPath}/json`,
      customSiteTitle: `${appName} API Documentation`,
      swaggerOptions: {
        displayRequestDuration: true,
        docExpansion: "none",
        filter: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
      },
    });

    this.initialized = true;

    ConsoleLogger.log(
      `Swagger setup complete at /${swaggerPath}`,
      "SwaggerService",
    );
  }
}
