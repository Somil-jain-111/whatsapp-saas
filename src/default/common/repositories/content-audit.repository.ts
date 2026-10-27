import { Injectable } from "@nestjs/common";
import { DataSource, QueryRunner } from "typeorm";
import {
  ContentAudit,
  ContentResourceType,
} from "../entities/content-audit.entity";

@Injectable()
export class ContentAuditRepository {
  constructor(private readonly dataSource: DataSource) {}

  async create(
    data: {
      resourceType: ContentResourceType;
      resourceId: number;
      actorId: number;
      actorRole: string;
      action: string;
      changes?: Record<string, unknown>;
    },
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = (
      queryRunner?.manager || this.dataSource.manager
    ).getRepository(ContentAudit);
    await repo.save(repo.create(data));
  }

  list(
    resourceType: ContentResourceType,
    resourceId: number,
  ): Promise<ContentAudit[]> {
    return this.dataSource.getRepository(ContentAudit).find({
      where: { resourceType, resourceId },
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        changes: true,
        createdAt: true,
      },
      order: { id: "DESC" },
      take: 200,
    });
  }
}
