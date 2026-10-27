import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { createHash } from "crypto";
import { catchError, from, mergeMap, Observable, throwError } from "rxjs";
import { TenantRequest } from "../../whatsapp-integration/interfaces/request-context.interface";
import { EntitlementService } from "./entitlement.service";

@Injectable()
export class ApiUsageMeteringInterceptor implements NestInterceptor {
  constructor(private readonly entitlements: EntitlementService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context
      .switchToHttp()
      .getRequest<TenantRequest & { journeyId?: string }>();
    if (!request.organizationId || !this.isMetered(request.path))
      return next.handle();
    const source = createHash("sha256")
      .update(
        `${request.method}:${request.path}:${request.journeyId ?? "unknown"}`,
      )
      .digest("hex");
    const reservation = await this.entitlements.reserveQuota(
      request.organizationId,
      "monthly_api_requests",
      1,
      `api:${source}`,
    );
    return next.handle().pipe(
      mergeMap(async (value) => {
        await this.entitlements.commitQuota(
          request.organizationId,
          reservation.id,
        );
        return value;
      }),
      catchError((error) => {
        return from(
          this.entitlements
            .releaseQuota(request.organizationId, reservation.id)
            .catch(() => null),
        ).pipe(mergeMap(() => throwError(() => error)));
      }),
    );
  }

  private isMetered(path: string) {
    return [
      "/contacts",
      "/messages",
      "/campaigns",
      "/templates",
      "/meta",
      "/whatsapp",
    ].some(
      (prefix) =>
        path === prefix ||
        path.startsWith(`${prefix}/`) ||
        path.includes(`/api/v1${prefix}`),
    );
  }
}
