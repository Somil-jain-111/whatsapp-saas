import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { WHATSAPP_SCHEMA } from "../database.schema";

@Entity({ schema: WHATSAPP_SCHEMA, name: "roles" })
@Index("idx_wa_roles_org_status", ["organizationId", "status"])
@Unique("uq_wa_roles_id_org", ["id", "organizationId"])
export class RoleEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId!: string | null;
  @Column({ type: "varchar", length: 50 }) name!: string;
  @Column({ type: "varchar", length: 100 }) code!: string;
  @Column({ type: "varchar", length: 30 }) scope!: string;
  @Column({ type: "varchar", length: 30, default: "ACTIVE" }) status!: string;
  @Column({ name: "is_system", type: "boolean", default: false })
  isSystem!: boolean;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "permissions" })
@Index("uq_wa_permissions_code", ["code"], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "varchar", length: 100 }) code!: string;
  @Column({ type: "varchar", length: 150 }) name!: string;
  @Column({ type: "varchar", length: 500, nullable: true }) description!:
    string | null;
  @Column({ type: "varchar", length: 30, default: "ACTIVE" }) status!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "role_permissions" })
@Unique("uq_wa_role_permissions_pair", ["roleId", "permissionId"])
export class RolePermissionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "role_id", type: "uuid" }) roleId!: string;
  @Column({ name: "permission_id", type: "uuid" }) permissionId!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "organization_members" })
@Unique("uq_wa_members_org_user", ["organizationId", "userId"])
@Index("idx_wa_members_org_status", ["organizationId", "status"])
@Index("idx_wa_members_user_status", ["userId", "status"])
@Check(
  "ck_wa_members_suspension",
  `status <> 'SUSPENDED' OR suspended_at IS NOT NULL`,
)
export class OrganizationMemberEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "role_id", type: "uuid" }) roleId!: string;
  @Column({ type: "varchar", length: 30, default: "ACTIVE" }) status!: string;
  @Column({ name: "invited_by_user_id", type: "uuid", nullable: true })
  invitedByUserId!: string | null;
  @Column({
    name: "joined_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  joinedAt!: Date;
  @Column({ name: "suspended_at", type: "timestamptz", nullable: true })
  suspendedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
