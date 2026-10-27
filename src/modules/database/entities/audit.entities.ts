import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { WHATSAPP_SCHEMA } from "../database.schema";

@Entity({ schema: WHATSAPP_SCHEMA, name: "platform_admins" })
@Unique("uq_wa_platform_admins_user", ["userId"])
@Index("idx_wa_platform_admins_status", ["status"])
export class PlatformAdminEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ type: "varchar", length: 30 }) role!: string;
  @Column({ type: "varchar", length: 30, default: "ACTIVE" }) status!: string;
  @Column({ name: "granted_by_admin_id", type: "uuid", nullable: true })
  grantedByAdminId!: string | null;
  @Column({
    name: "granted_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  grantedAt!: Date;
  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "audit_logs" })
@Index("idx_wa_audit_org_created_id", ["organizationId", "createdAt", "id"])
@Index("idx_wa_audit_actor_created", ["actorUserId", "createdAt"])
export class AuditLogEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId!: string | null;
  @Column({ name: "actor_user_id", type: "uuid", nullable: true })
  actorUserId!: string | null;
  @Column({ name: "actor_platform_admin_id", type: "uuid", nullable: true })
  actorPlatformAdminId!: string | null;
  @Column({ type: "varchar", length: 100 }) action!: string;
  @Column({ name: "resource_type", type: "varchar", length: 100 })
  resourceType!: string;
  @Column({ name: "resource_id", type: "uuid", nullable: true }) resourceId!:
    string | null;
  @Column({ name: "ip_address", type: "inet", nullable: true }) ipAddress!:
    string | null;
  @Column({ name: "request_id", type: "varchar", length: 100, nullable: true })
  requestId!: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata!: Record<
    string,
    unknown
  >;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "security_events" })
@Index("idx_wa_security_org_created", ["organizationId", "createdAt"])
@Index("idx_wa_security_user_created", ["userId", "createdAt"])
@Index("idx_wa_security_severity_created", ["severity", "createdAt"])
export class SecurityEventEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId!: string | null;
  @Column({ name: "user_id", type: "uuid", nullable: true }) userId!:
    string | null;
  @Column({ name: "event_type", type: "varchar", length: 100 })
  eventType!: string;
  @Column({ type: "varchar", length: 20 }) severity!: string;
  @Column({ name: "ip_address", type: "inet", nullable: true }) ipAddress!:
    string | null;
  @Column({ name: "request_id", type: "varchar", length: 100, nullable: true })
  requestId!: string | null;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) metadata!: Record<
    string,
    unknown
  >;
  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
