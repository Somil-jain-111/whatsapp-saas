import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { UserRole } from "../enums/user-type.enum";
import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";
import { ALLOW_UNAPPROVED_SELLER_WRITE } from "../decorators/allow-unapproved-seller-write.decorator";
import { SellerWriteAccessService } from "../services/seller-write-access.service";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class SellerApprovalWriteInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: SellerWriteAccessService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== "POST") return next.handle();

    const exempt = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNAPPROVED_SELLER_WRITE,
      [context.getHandler(), context.getClass()],
    );
    if (exempt) return next.handle();

    const endpointRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requestUrl = String(request.originalUrl ?? request.url ?? "");
    // A controller can expose both customer and seller aliases. Route identity
    // takes precedence so a dual-role user is not blocked on customer writes.
    const isCustomerRoute = requestUrl.includes("/customers/");
    const isSellerEndpoint =
      !isCustomerRoute &&
      (endpointRoles?.includes(UserRole.SELLER_ADMIN) ||
        requestUrl.includes("/sellers/") ||
        requestUrl.includes("/seller/"));
    if (!isSellerEndpoint) return next.handle();

    const roles: string[] = Array.isArray(request.user?.role)
      ? request.user.role
      : [request.user?.role].filter(Boolean);
    const normalized = roles.map((role) => String(role).toLowerCase());
    const isSeller = normalized.includes(UserRole.SELLER_ADMIN);
    const isPlatformAdmin =
      normalized.includes(UserRole.ADMIN) ||
      normalized.includes(UserRole.SUPERADMIN);

    if (!isSeller || isPlatformAdmin) return next.handle();

    if (!(await this.accessService.isApproved(Number(request.user.id)))) {
      throw new BusinessException(
        ERROR_CODES.SELLER.WRITE_ACCESS_REQUIRES_APPROVAL,
      );
    }

    return next.handle();
  }
}
