import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { catchError, Observable, tap, throwError } from "rxjs";
import { PublicApiRequest } from "./developer-request.interface";
import { DeveloperPortalRepository } from "./developer-portal.repository";

@Injectable()
export class PublicApiLogInterceptor implements NestInterceptor {
  constructor(private readonly repo: DeveloperPortalRepository) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<PublicApiRequest>();
    const response = context.switchToHttp().getResponse();
    const started = Date.now();
    const log = (error?: any) => {
      if (!request.apiKey || !request.requestId) return;
      void this.repo.appendRequestLog({
        requestId: request.requestId,
        organizationId: request.organizationId,
        apiKeyId: request.apiKey.id,
        endpoint: request.route?.path ?? request.path,
        method: request.method,
        statusCode: error?.status ?? response.statusCode,
        latencyMs: Date.now() - started,
        sourceIp: request.ip.startsWith("::ffff:")
          ? request.ip.slice(7)
          : request.ip,
        errorCode: error?.response?.code,
        environment: request.apiKey.environment,
        messageOperationId: response.locals.messageOperationId,
      });
    };
    return next.handle().pipe(
      tap(() => log()),
      catchError((error) => {
        log(error);
        return throwError(() => error);
      }),
    );
  }
}
