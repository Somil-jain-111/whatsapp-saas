import { Injectable } from "@nestjs/common";
import { DeepPartial } from "typeorm";
import { SecurityEventEntity } from "../database/entities";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class SecurityEventsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  append(
    organizationId: string,
    event: DeepPartial<SecurityEventEntity>,
  ): Promise<SecurityEventEntity> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager.save(
        SecurityEventEntity,
        manager.create(SecurityEventEntity, { ...event, organizationId }),
      ),
    );
  }
}
