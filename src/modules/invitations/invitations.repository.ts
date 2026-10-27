import { Injectable } from "@nestjs/common";
import { DeepPartial } from "typeorm";
import { InvitationEntity } from "../database/entities";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class InvitationsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  create(
    organizationId: string,
    data: DeepPartial<InvitationEntity>,
  ): Promise<InvitationEntity> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager.save(
        InvitationEntity,
        manager.create(InvitationEntity, { ...data, organizationId }),
      ),
    );
  }

  consume(
    organizationId: string,
    tokenHash: string,
  ): Promise<InvitationEntity | null> {
    return this.tenantContext.run(organizationId, async (manager) => {
      const result: InvitationEntity[] | [InvitationEntity[], number] =
        await manager.query(
          `UPDATE whatsapp_core.invitations SET status = 'ACCEPTED', accepted_at = now(), updated_at = now()
         WHERE organization_id = $1 AND token_hash = $2 AND status = 'PENDING' AND expires_at > now()
         RETURNING *`,
          [organizationId, tokenHash],
        );
      const rows = Array.isArray(result[0])
        ? result[0]
        : (result as InvitationEntity[]);
      return rows[0] ?? null;
    });
  }
}
