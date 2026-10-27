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

@Entity({ schema: WHATSAPP_SCHEMA, name: "invitations" })
@Index("idx_wa_invitations_org_status_expires", [
  "organizationId",
  "status",
  "expiresAt",
])
@Unique("uq_wa_invitations_token_hash", ["tokenHash"])
export class InvitationEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "email_normalized", type: "varchar", length: 254 })
  emailNormalized!: string;
  @Column({ name: "role_id", type: "uuid" }) roleId!: string;
  @Column({ name: "token_hash", type: "char", length: 64, select: false })
  tokenHash!: string;
  @Column({ type: "varchar", length: 30, default: "PENDING" }) status!: string;
  @Column({ name: "invited_by_user_id", type: "uuid" })
  invitedByUserId!: string;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
  acceptedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "sessions" })
@Unique("uq_wa_sessions_token_hash", ["tokenHash"])
@Index("idx_wa_sessions_user_active", ["userId", "revokedAt", "expiresAt"])
export class SessionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ name: "token_hash", type: "char", length: 64, select: false })
  tokenHash!: string;
  @Column({ name: "ip_address", type: "inet", nullable: true }) ipAddress!:
    string | null;
  @Column({ name: "user_agent", type: "varchar", length: 1024, nullable: true })
  userAgent!: string | null;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
  revokedAt!: Date | null;
  @Column({
    name: "revocation_reason",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  revocationReason!: string | null;
  @Column({ name: "last_seen_at", type: "timestamptz", nullable: true })
  lastSeenAt!: Date | null;
  @Column({ name: "mfa_verified_at", type: "timestamptz", nullable: true })
  mfaVerifiedAt!: Date | null;
  @Column({
    name: "auth_method",
    type: "varchar",
    length: 20,
    default: "PASSWORD",
  })
  authMethod!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

abstract class ExpiringTokenEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({
    name: "token_hash",
    type: "char",
    length: 64,
    unique: true,
    select: false,
  })
  tokenHash!: string;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "email_verifications" })
@Index("idx_wa_email_verifications_user_created", ["userId", "createdAt"])
export class EmailVerificationEntity extends ExpiringTokenEntity {}

@Entity({ schema: WHATSAPP_SCHEMA, name: "password_resets" })
@Index("idx_wa_password_resets_user_created", ["userId", "createdAt"])
export class PasswordResetEntity extends ExpiringTokenEntity {}

@Entity({ schema: WHATSAPP_SCHEMA, name: "user_mfa_factors" })
@Unique("uq_wa_mfa_user_name", ["userId", "name"])
@Index("idx_wa_mfa_user_status", ["userId", "status"])
export class UserMfaFactorEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "uuid" }) userId!: string;
  @Column({ type: "varchar", length: 30 }) type!: string;
  @Column({ type: "varchar", length: 100 }) name!: string;
  @Column({ name: "secret_ciphertext", type: "bytea", select: false })
  secretCiphertext!: Buffer;
  @Column({ name: "secret_nonce", type: "bytea", select: false })
  secretNonce!: Buffer;
  @Column({ name: "secret_auth_tag", type: "bytea", select: false })
  secretAuthTag!: Buffer;
  @Column({ name: "key_version", type: "varchar", length: 50 })
  keyVersion!: string;
  @Column({ type: "varchar", length: 30, default: "PENDING" }) status!: string;
  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
