import { Injectable } from "@nestjs/common";
import { DeepPartial } from "typeorm";
import { OrganizationMemberEntity } from "../database/entities";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class MembershipsRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  create(
    organizationId: string,
    data: DeepPartial<OrganizationMemberEntity>,
  ): Promise<OrganizationMemberEntity> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager.save(
        OrganizationMemberEntity,
        manager.create(OrganizationMemberEntity, { ...data, organizationId }),
      ),
    );
  }

  list(organizationId: string, take = 50): Promise<OrganizationMemberEntity[]> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager.find(OrganizationMemberEntity, {
        where: { organizationId },
        order: { createdAt: "DESC" },
        take: Math.min(Math.max(take, 1), 100),
      }),
    );
  }
}
