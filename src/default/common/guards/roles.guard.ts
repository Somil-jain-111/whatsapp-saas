import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { BusinessException } from "src/default/error/business.exception";
import { ERROR_CODES } from "src/default/error/error.code";
import { UserRole } from "../enums/user-type.enum";
import { DataSource } from "typeorm";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride: a handler-level @Roles() wins over a class-level one (intentional
    // per-method override), but a class-level-only @Roles() must still be enforced — reading
    // only context.getHandler() silently no-ops every controller that applies @Roles() at
    // the class level instead of per-method.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      "roles",
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userRoles: string[] = Array.isArray(request.user?.role)
      ? request.user.role
      : [request.user?.role].filter(Boolean);
    const normalizedRoles = userRoles.map((role) => role.toLowerCase());

    const hasRole = requiredRoles.some((role) =>
      normalizedRoles.includes(role.toLowerCase()),
    );

    if (!hasRole) {
      throw new BusinessException(ERROR_CODES.AUTH.REQUIRED_ROLES_MISSING);
    }

    const permission = this.reflector.getAllAndOverride<string>("permission", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      permission &&
      !normalizedRoles.includes(UserRole.SUPERADMIN) &&
      normalizedRoles.includes(UserRole.ADMIN)
    ) {
      const [access] = await this.db.query(
        `SELECT assignment.id FROM admin_operational_role_assignments assignment
         INNER JOIN admin_operational_roles role ON role.id=assignment.role_id
           AND role.active=1 AND role.deleted_at IS NULL
         LEFT JOIN admin_operational_role_permissions permission
           ON permission.role_id=role.id AND permission.permission=?
           AND permission.active=1 AND permission.deleted_at IS NULL
         WHERE assignment.user_id=? AND assignment.active=1 AND assignment.deleted_at IS NULL
           AND (role.code='FULL_ACCESS' OR permission.id IS NOT NULL) LIMIT 1`,
        [permission, request.user.id],
      );
      if (!access)
        throw new BusinessException(ERROR_CODES.ROLE.ROLE_PERMISSION_DENIED);
    }

    return true;
  }
}
