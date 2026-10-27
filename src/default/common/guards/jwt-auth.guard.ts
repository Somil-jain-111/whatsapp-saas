import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";
import { ConsoleLogger } from "src/default/logger/console/console.service";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    ConsoleLogger.warn("JWT_AUTH_FAILED_DEBUG", {
      tag: "JwtAuthGuard.handleRequest",
      data: {
        err: err?.message || null,
        user: user || null,
        info: info?.message || info?.name || info || null,
        hasAuthorizationHeader: Boolean(request.headers?.authorization),
      },
    });

    if (err || !user) {
      throw new BusinessException(ERROR_CODES.AUTH.UNAUTHORIZED_ACCESS);
    }

    return user;
  }
}
