import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import {
  OrganizationEntity,
  OrganizationMemberEntity,
  RoleEntity,
} from "../database/entities";
import { OrganizationsRepository } from "./organizations.repository";

export interface CreateOrganizationData {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  ownerUserId: string;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly organizations: OrganizationsRepository,
  ) {}

  createWithOwner(data: CreateOrganizationData): Promise<OrganizationEntity> {
    return this.tenantContext.run(data.id, async (manager) => {
      const ownerRole = await manager.findOneBy(RoleEntity, {
        organizationId: null,
        code: "owner",
        scope: "ORGANIZATION",
        status: "ACTIVE",
      });
      if (!ownerRole) throw new Error("Seeded owner role is missing");

      const organization = await this.organizations.create(manager, data);
      await manager.insert(OrganizationMemberEntity, {
        organizationId: organization.id,
        userId: data.ownerUserId,
        roleId: ownerRole.id,
        status: "ACTIVE",
      });
      return organization;
    });
  }
}
