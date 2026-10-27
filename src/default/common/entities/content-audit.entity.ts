import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "./base.entity";

export enum ContentResourceType {
  CATEGORY = "CATEGORY",
  PRODUCT = "PRODUCT",
  CMS_BANNER = "CMS_BANNER",
  CMS_ANNOUNCEMENT = "CMS_ANNOUNCEMENT",
  CMS_SECTION = "CMS_SECTION",
  COUPON = "COUPON",
}

@Entity("content_audits")
@Index(["resourceType", "resourceId", "createdAt"])
export class ContentAudit extends BaseEntity {
  @Column({ type: "enum", enum: ContentResourceType, name: "resource_type" })
  resourceType!: ContentResourceType;

  @Column({ type: "bigint", name: "resource_id" })
  resourceId!: number;

  @Column({ type: "bigint", name: "actor_id" })
  actorId!: number;

  @Column({ type: "varchar", length: 50, name: "actor_role" })
  actorRole!: string;

  @Column({ type: "varchar", length: 50 })
  action!: string;

  @Column({ type: "json", nullable: true })
  changes?: Record<string, unknown> | null;
}
