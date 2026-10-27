import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ConsoleLogger } from "../../logger/console/console.service";
import { DataSanitizer } from "../utils/sanitize.utils";
import { LocalStorageContextUtil } from "../utils/local-storage.util";
import { ContextType } from "../constants/context.option";
import { Reflector } from "@nestjs/core";
import { AUTH_RESPONSE_KEY } from "../decorators/auth-response.decorator";
import { SSE_METADATA } from "@nestjs/common/constants";

@Injectable()
export class UnifiedResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (this.reflector.get<boolean>(SSE_METADATA, context.getHandler()))
      return next.handle();
    const customMessage = this.reflector.get<string>(
      "responseMessage",
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        if (
          context.switchToHttp().getRequest().originalUrl ===
          "/public/oauth/token"
        )
          return DataSanitizer.sanitizeData(data, [], ["password", "otp"]);
        // Auth endpoints intentionally return newly-issued access/refresh tokens. Every
        // other controller gets the full defence-in-depth sensitive-field deny-list.
        const isAuthController = this.reflector.getAllAndOverride<boolean>(
          AUTH_RESPONSE_KEY,
          [context.getHandler(), context.getClass()],
        );
        const sanitizedData = isAuthController
          ? DataSanitizer.sanitizeData(data, [], ["password", "otp"])
          : DataSanitizer.sanitizeData(data);
        return this.formatResponse(sanitizedData, context, customMessage);
      }),
    );
  }

  private formatResponse(
    data: any,
    context: ExecutionContext,
    customMessage?: string,
  ): any {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const journeyId = LocalStorageContextUtil.get(ContextType.JOURNEY_ID);
    const currentUser = LocalStorageContextUtil.get(ContextType.CURRENT_USER);
    const message = customMessage || "Request successful";
    const statusCode =
      process.env.MAINTANCE_MODE === "true" ? 503 : response.statusCode;
    if (statusCode === 503) response.status(statusCode);
    if (request.originalUrl?.startsWith("/public/v1")) {
      return {
        success: true,
        data,
        request_id: request.requestId,
      };
    }
    const formattedResponse = {
      status: true,
      code: statusCode,
      message,
      data,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      sub: currentUser,
      journeyId,
    };

    // Authentication responses must reach the caller, but credentials must never enter logs.
    ConsoleLogger.log(
      DataSanitizer.sanitizeData(formattedResponse, [
        "secret",
        "signingSecret",
        "apiKey",
      ]),
      `${request.method} - ${request.url}`,
    );

    return formattedResponse;
  }
}
