import { Injectable } from "@nestjs/common";
import { RoleEntity } from "../database/entities";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class RolesRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  listForOrganization(organizationId: string): Promise<RoleEntity[]> {
    return this.tenantContext.run(organizationId, (manager) =>
      manager
        .createQueryBuilder(RoleEntity, "role")
        .where(
          "role.organization_id IS NULL OR role.organization_id = :organizationId",
          { organizationId },
        )
        .andWhere("role.scope = :scope AND role.status = :status", {
          scope: "ORGANIZATION",
          status: "ACTIVE",
        })
        .orderBy("role.name", "ASC")
        .getMany(),
    );
  }
}
