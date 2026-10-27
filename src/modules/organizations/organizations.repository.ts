import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { OrganizationEntity } from "../database/entities";

@Injectable()
export class OrganizationsRepository {
  create(
    manager: EntityManager,
    values: Partial<OrganizationEntity>,
  ): Promise<OrganizationEntity> {
    return manager.save(
      OrganizationEntity,
      manager.create(OrganizationEntity, values),
    );
  }

  findById(
    manager: EntityManager,
    id: string,
  ): Promise<OrganizationEntity | null> {
    return manager.findOneBy(OrganizationEntity, { id });
  }
}
