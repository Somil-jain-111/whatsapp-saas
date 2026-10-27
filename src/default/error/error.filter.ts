import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";

import { ConsoleLogger } from "../logger/console/console.service";
import { ERROR_CODES } from "./error.code";
import { DataSanitizer } from "../common/utils/sanitize.utils";

type HttpExceptionResponse = {
  errorCode?: string;
  code?: string | number;
  message?: string | string[];
  data?: unknown;
  error?: string;
  error_description?: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // console.log('ALL EXCEPTIONS FILTER CALLED');
    // console.log('EXCEPTION:', exception);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest() as any;

    if (response.headersSent) {
      return;
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const normalizedError = this.normalizeException(
      exception,
      exceptionResponse,
      status,
    );

    if ((request.originalUrl || request.url) === "/public/oauth/token") {
      const oauthError = this.isHttpExceptionResponse(exceptionResponse)
        ? exceptionResponse
        : null;
      response.status(status).json(
        DataSanitizer.sanitizeData(
          {
            error:
              oauthError?.error ??
              (status === 401 ? "invalid_client" : "server_error"),
            error_description:
              oauthError?.error_description ?? normalizedError.message,
          },
          [],
          [],
        ),
      );
      return;
    }

    const errorResponse = {
      status: false,
      code: status,
      errorCode: normalizedError.errorCode,
      message: normalizedError.message,
      data: normalizedError.data,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      sub: request.user?.userId || null,
      journeyId: request.journeyId || null,
    };

    ConsoleLogger.error(
      `Handled Error - Code: ${errorResponse.code}, ErrorCode: ${errorResponse.errorCode}, Message: ${errorResponse.message}, JourneyId: ${errorResponse.journeyId}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
      `${request.method} - ${request.url}`,
    );

    if ((request.originalUrl || request.url)?.startsWith("/public/v1")) {
      response.status(status).json({
        success: false,
        error: {
          code: normalizedError.errorCode,
          message: normalizedError.message,
        },
        request_id: request.requestId || null,
      });
      return;
    }

    response.status(status).json(DataSanitizer.sanitizeData(errorResponse));
  }

  private normalizeException(
    exception: unknown,
    exceptionResponse: string | object | null,
    status: number,
  ): { errorCode: string; message: string; data: unknown } {
    const defaultError = this.getDefaultError(status);

    if (typeof exceptionResponse === "string") {
      return {
        errorCode: defaultError.code,
        message: exceptionResponse,
        data: null,
      };
    }

    if (this.isHttpExceptionResponse(exceptionResponse)) {
      return {
        errorCode:
          exceptionResponse.errorCode ??
          (typeof exceptionResponse.code === "string"
            ? exceptionResponse.code
            : defaultError.code),

        message: this.normalizeMessage(
          exceptionResponse.message,
          defaultError.message,
        ),

        data: exceptionResponse.data ?? null,
      };
    }

    // Unrecognized (non-HttpException) errors can carry raw internals (DB driver text, SDK
    // errors, etc.) in `exception.message` — only surface that to clients outside production.
    const isProduction = process.env.NODE_ENV === "production";
    const rawMessage = exception instanceof Error && exception.message;

    return {
      errorCode: defaultError.code,
      message: !isProduction && rawMessage ? rawMessage : defaultError.message,
      data: null,
    };
  }

  private isHttpExceptionResponse(
    response: string | object | null,
  ): response is HttpExceptionResponse {
    return typeof response === "object" && response !== null;
  }

  private normalizeMessage(
    message: string | string[] | undefined,
    fallback: string,
  ): string {
    if (Array.isArray(message)) {
      return message.join(", ");
    }

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }

    return fallback;
  }

  private getDefaultError(status: number): { code: string; message: string } {
    if (status === HttpStatus.BAD_REQUEST) {
      return ERROR_CODES.COMMON.BAD_REQUEST;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      return ERROR_CODES.AUTH.UNAUTHORIZED_ACCESS;
    }

    if (status === HttpStatus.FORBIDDEN) {
      return ERROR_CODES.AUTH.FORBIDDEN_ACCESS;
    }

    if (status === HttpStatus.NOT_FOUND) {
      return ERROR_CODES.COMMON.NOT_FOUND;
    }

    return ERROR_CODES.COMMON.SOMETHING_WENT_WRONG;
  }
}
