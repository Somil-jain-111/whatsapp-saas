import { Injectable } from "@nestjs/common";
import { DeepPartial } from "typeorm";
import { AuditLogEntity } from "../database/entities";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class AuditRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  append(
    organizationId: string,
    event: DeepPartial<AuditLogEntity>,
  ): Promise<AuditLogEntity> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager.save(
        AuditLogEntity,
        manager.create(AuditLogEntity, { ...event, organizationId }),
      ),
    );
  }
}
