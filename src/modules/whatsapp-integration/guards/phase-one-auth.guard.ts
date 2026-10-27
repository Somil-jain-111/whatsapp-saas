import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { AppConfigService } from "../../../default/config/config.service";
import { SessionEntity, UserEntity } from "../../database/entities";
import { TenantRequest } from "../interfaces/request-context.interface";

interface AccessClaims {
  sub?: string;
  sid?: string;
  type?: string;
}

@Injectable()
export class PhaseOneAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer "))
      throw new UnauthorizedException();

    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(
        authorization.slice(7),
        {
          secret: this.config.getJwtAccessSecret(),
          algorithms: ["HS256"],
        },
      );
    } catch {
      throw new UnauthorizedException();
    }
    if (!claims.sub || !claims.sid || claims.type !== "access") {
      throw new UnauthorizedException();
    }

    const session = await this.dataSource.getRepository(SessionEntity).findOne({
      where: { id: claims.sid, userId: claims.sub },
    });
    const user = await this.dataSource.getRepository(UserEntity).findOne({
      where: { id: claims.sub },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !user ||
      user.deletedAt ||
      user.status !== "ACTIVE"
    ) {
      throw new UnauthorizedException();
    }
    const [policy] = await this.dataSource.query(
      `SELECT min(p.idle_timeout_minutes)::integer idle_minutes FROM whatsapp_core.organization_members m
       JOIN whatsapp_core.organization_security_policies p ON p.organization_id=m.organization_id
       JOIN whatsapp_core.organizations o ON o.id=m.organization_id AND o.status='ACTIVE'
       WHERE m.user_id=$1 AND m.status='ACTIVE'`,
      [user.id],
    );
    if (
      policy?.idle_minutes &&
      session.lastSeenAt &&
      session.lastSeenAt.getTime() <
        Date.now() - Number(policy.idle_minutes) * 60_000
    ) {
      await this.dataSource.query(
        `UPDATE whatsapp_core.sessions SET revoked_at=now(),revocation_reason='Idle timeout' WHERE id=$1 AND revoked_at IS NULL`,
        [session.id],
      );
      throw new UnauthorizedException("Session expired due to inactivity");
    }
    if (
      !session.lastSeenAt ||
      session.lastSeenAt.getTime() < Date.now() - 60_000
    )
      await this.dataSource.query(
        `UPDATE whatsapp_core.sessions SET last_seen_at=now() WHERE id=$1 AND revoked_at IS NULL`,
        [session.id],
      );
    request.user = { id: user.id, sessionId: session.id };
    return true;
  }
}
