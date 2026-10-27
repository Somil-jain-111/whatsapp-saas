import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";

@Injectable()
export class TenantContextService {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(
    organizationId: string,
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.organization_id', $1, true)`,
        [organizationId],
      );
      await manager.query(
        `SELECT set_config('app.is_platform_admin', 'false', true)`,
      );
      return callback(manager);
    });
  }

  async runAsPlatformAdmin<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT set_config('app.is_platform_admin', 'true', true)`,
      );
      return callback(manager);
    });
  }
}
