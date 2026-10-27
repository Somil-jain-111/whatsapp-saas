import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { TenantRequest } from "../../whatsapp-integration/interfaces/request-context.interface";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const [admin] = await this.dataSource.query(
      `SELECT id,role FROM whatsapp_core.platform_admins WHERE user_id=$1 AND status='ACTIVE'`,
      [request.user.id],
    );
    if (!admin)
      throw new ForbiddenException("Platform administrator access required");
    (request as any).platformAdmin = admin;
    return true;
  }
}
