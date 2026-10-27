import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { validate as isUuid } from "uuid";
import { TenantContextService } from "../../database/tenant-context.service";
import { TenantRequest } from "../interfaces/request-context.interface";

const PERMISSION = "whatsapp.permission";
export const RequireWhatsappPermission = (permission: string) =>
  SetMetadata(PERMISSION, permission);

@Injectable()
export class TenantPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenants: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const organizationId = request.header("x-organization-id");
    if (!organizationId || !isUuid(organizationId)) {
      throw new BadRequestException(
        "A valid x-organization-id header is required",
      );
    }

    const allowed = await this.tenants.run(organizationId, async (manager) => {
      const rows = await manager.query(
        `SELECT 1
           FROM whatsapp_core.organization_members m
           JOIN whatsapp_core.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
           JOIN whatsapp_core.roles r ON r.id = m.role_id
           JOIN whatsapp_core.sessions s ON s.id=$4 AND s.user_id=m.user_id AND s.revoked_at IS NULL AND s.expires_at>now()
           LEFT JOIN whatsapp_core.organization_security_policies sp ON sp.organization_id=m.organization_id
           LEFT JOIN whatsapp_core.role_permissions rp ON rp.role_id = r.id
           LEFT JOIN whatsapp_core.permissions p ON p.id = rp.permission_id
          WHERE m.organization_id = $1 AND m.user_id = $2 AND m.status = 'ACTIVE'
            AND r.status = 'ACTIVE' AND ($3::varchar IS NULL OR p.code = $3)
            AND (sp.organization_id IS NULL OR s.last_seen_at>=now()-(sp.idle_timeout_minutes || ' minutes')::interval)
            AND (coalesce(sp.require_mfa,false)=false OR s.mfa_verified_at IS NOT NULL)
            AND (coalesce(sp.password_login_enabled,true)=true OR s.auth_method='OIDC')
          LIMIT 1`,
        [
          organizationId,
          request.user.id,
          permission ?? null,
          request.user.sessionId,
        ],
      );
      if (rows.length)
        await manager.query(
          `UPDATE whatsapp_core.sessions SET last_seen_at=now() WHERE id=$1 AND last_seen_at<now()-interval '1 minute'`,
          [request.user.sessionId],
        );
      return rows.length > 0;
    });
    if (!allowed) throw new ForbiddenException();
    request.organizationId = organizationId;
    return true;
  }
}
