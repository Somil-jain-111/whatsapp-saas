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

@Entity({ schema: WHATSAPP_SCHEMA, name: "meta_connections" })
@Unique("uq_meta_connections_id_org", ["id", "organizationId"])
@Index("idx_meta_connections_org_status", ["organizationId", "status"])
export class MetaConnectionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ type: "varchar", length: 40, default: "CONNECTING" })
  status!: string;
  @Column({
    name: "provider_business_id",
    type: "varchar",
    length: 64,
    nullable: true,
  })
  providerBusinessId!: string | null;
  @Column({
    name: "credential_ciphertext",
    type: "bytea",
    nullable: true,
    select: false,
  })
  credentialCiphertext!: Buffer | null;
  @Column({
    name: "credential_nonce",
    type: "bytea",
    nullable: true,
    select: false,
  })
  credentialNonce!: Buffer | null;
  @Column({
    name: "credential_auth_tag",
    type: "bytea",
    nullable: true,
    select: false,
  })
  credentialAuthTag!: Buffer | null;
  @Column({ name: "key_version", type: "varchar", length: 100, nullable: true })
  keyVersion!: string | null;
  @Column({
    name: "credential_created_at",
    type: "timestamptz",
    nullable: true,
  })
  credentialCreatedAt!: Date | null;
  @Column({
    name: "credential_rotated_at",
    type: "timestamptz",
    nullable: true,
  })
  credentialRotatedAt!: Date | null;
  @Column({ name: "token_expires_at", type: "timestamptz", nullable: true })
  tokenExpiresAt!: Date | null;
  @Column({ name: "last_synced_at", type: "timestamptz", nullable: true })
  lastSyncedAt!: Date | null;
  @Column({ name: "last_failed_at", type: "timestamptz", nullable: true })
  lastFailedAt!: Date | null;
  @Column({ name: "disconnected_at", type: "timestamptz", nullable: true })
  disconnectedAt!: Date | null;
  @Column({
    name: "disconnect_reason",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  disconnectReason!: string | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "meta_onboarding_sessions" })
@Index("idx_meta_onboarding_org_expires", ["organizationId", "expiresAt"])
@Unique("uq_meta_onboarding_state_hash", ["stateHash"])
export class MetaOnboardingSessionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "created_by_user_id", type: "uuid" })
  createdByUserId!: string;
  @Column({ name: "state_hash", type: "char", length: 64, select: false })
  stateHash!: string;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @Column({ name: "consumed_at", type: "timestamptz", nullable: true })
  consumedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "whatsapp_accounts" })
@Unique("uq_whatsapp_accounts_id_org", ["id", "organizationId"])
@Unique("uq_whatsapp_accounts_provider_id", ["providerAccountId"])
@Index("idx_whatsapp_accounts_org_status", ["organizationId", "status"])
export class WhatsappAccountEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "connection_id", type: "uuid" }) connectionId!: string;
  @Column({ name: "provider_account_id", type: "varchar", length: 64 })
  providerAccountId!: string;
  @Column({
    name: "business_name",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  businessName!: string | null;
  @Column({ type: "varchar", length: 40, default: "UNKNOWN" }) status!: string;
  @Column({
    name: "verification_status",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  verificationStatus!: string | null;
  @Column({ name: "last_synced_at", type: "timestamptz", nullable: true })
  lastSyncedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "whatsapp_phone_numbers" })
@Unique("uq_whatsapp_phone_numbers_provider_id", ["providerPhoneNumberId"])
@Index("idx_whatsapp_phone_org_account", ["organizationId", "accountId"])
export class WhatsappPhoneNumberEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "account_id", type: "uuid" }) accountId!: string;
  @Column({ name: "provider_phone_number_id", type: "varchar", length: 64 })
  providerPhoneNumberId!: string;
  @Column({ name: "display_phone_number", type: "varchar", length: 64 })
  displayPhoneNumber!: string;
  @Column({ name: "phone_e164", type: "varchar", length: 16, nullable: true })
  phoneE164!: string | null;
  @Column({
    name: "verified_display_name",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  verifiedDisplayName!: string | null;
  @Column({
    name: "quality_rating",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  qualityRating!: string | null;
  @Column({
    name: "messaging_limit",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  messagingLimit!: string | null;
  @Column({ type: "varchar", length: 40, default: "UNKNOWN" }) status!: string;
  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean;
  @Column({ name: "last_synced_at", type: "timestamptz", nullable: true })
  lastSyncedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "message_templates" })
@Unique("uq_message_templates_id_org", ["id", "organizationId"])
@Unique("uq_message_templates_org_account_name_language", [
  "organizationId",
  "accountId",
  "name",
  "language",
])
@Index("idx_message_templates_org_status", [
  "organizationId",
  "localStatus",
  "metaStatus",
])
export class MessageTemplateEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "account_id", type: "uuid" }) accountId!: string;
  @Column({
    name: "provider_template_id",
    type: "varchar",
    length: 64,
    nullable: true,
  })
  providerTemplateId!: string | null;
  @Column({ type: "varchar", length: 512 }) name!: string;
  @Column({ type: "varchar", length: 20 }) language!: string;
  @Column({ type: "varchar", length: 30 }) category!: string;
  @Column({
    name: "local_status",
    type: "varchar",
    length: 40,
    default: "DRAFT",
  })
  localStatus!: string;
  @Column({ name: "meta_status", type: "varchar", length: 40, nullable: true })
  metaStatus!: string | null;
  @Column({
    name: "raw_provider_status",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  rawProviderStatus!: string | null;
  @Column({
    name: "rejection_reason",
    type: "varchar",
    length: 1000,
    nullable: true,
  })
  rejectionReason!: string | null;
  @Column({ name: "current_version", type: "integer", default: 1 })
  currentVersion!: number;
  @Column({ name: "provider_deleted_at", type: "timestamptz", nullable: true })
  providerDeletedAt!: Date | null;
  @Column({ name: "archived_at", type: "timestamptz", nullable: true })
  archivedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "template_components" })
@Unique("uq_template_components_version_position", [
  "templateId",
  "version",
  "position",
])
export class TemplateComponentEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "template_id", type: "uuid" }) templateId!: string;
  @Column({ type: "integer" }) version!: number;
  @Column({ type: "integer" }) position!: number;
  @Column({ type: "varchar", length: 30 }) type!: string;
  @Column({ type: "jsonb" }) payload!: Record<string, unknown>;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "template_versions" })
@Unique("uq_template_versions_number", ["templateId", "version"])
export class TemplateVersionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "template_id", type: "uuid" }) templateId!: string;
  @Column({ type: "integer" }) version!: number;
  @Column({ type: "jsonb" }) snapshot!: Record<string, unknown>;
  @Column({ name: "created_by_user_id", type: "uuid" })
  createdByUserId!: string;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "meta_webhook_events" })
@Unique("uq_meta_webhook_dedup", ["deduplicationKey"])
@Index("idx_meta_webhook_processing", ["status", "nextAttemptAt", "receivedAt"])
export class MetaWebhookEventEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid", nullable: true })
  organizationId!: string | null;
  @Column({ name: "deduplication_key", type: "char", length: 64 })
  deduplicationKey!: string;
  @Column({ type: "jsonb" }) payload!: Record<string, unknown>;
  @Column({ type: "varchar", length: 30, default: "PENDING" }) status!: string;
  @Column({ type: "integer", default: 0 }) attempts!: number;
  @Column({ name: "next_attempt_at", type: "timestamptz", nullable: true })
  nextAttemptAt!: Date | null;
  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null;
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date;
  @CreateDateColumn({ name: "received_at", type: "timestamptz" })
  receivedAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "integration_sync_jobs" })
@Index("idx_integration_sync_jobs_run", ["status", "availableAt"])
@Index("idx_integration_sync_jobs_org_created", ["organizationId", "createdAt"])
export class IntegrationSyncJobEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "connection_id", type: "uuid", nullable: true })
  connectionId!: string | null;
  @Column({ type: "varchar", length: 50 }) type!: string;
  @Column({ type: "varchar", length: 30, default: "PENDING" }) status!: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) cursor!: Record<
    string,
    unknown
  >;
  @Column({ type: "integer", default: 0 }) attempts!: number;
  @Column({
    name: "available_at",
    type: "timestamptz",
    default: () => "CURRENT_TIMESTAMP",
  })
  availableAt!: Date;
  @Column({ name: "finished_at", type: "timestamptz", nullable: true })
  finishedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}

@Entity({ schema: WHATSAPP_SCHEMA, name: "integration_errors" })
@Index("idx_integration_errors_org_occurred", ["organizationId", "occurredAt"])
@Index("idx_integration_errors_unresolved", ["resolvedAt", "occurredAt"])
export class IntegrationErrorEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "organization_id", type: "uuid" }) organizationId!: string;
  @Column({ name: "connection_id", type: "uuid", nullable: true })
  connectionId!: string | null;
  @Column({ type: "varchar", length: 100 }) code!: string;
  @Column({ type: "varchar", length: 1000 }) message!: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) context!: Record<
    string,
    unknown
  >;
  @Column({ name: "occurrence_count", type: "integer", default: 1 })
  occurrenceCount!: number;
  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;
  @CreateDateColumn({ name: "occurred_at", type: "timestamptz" })
  occurredAt!: Date;
}
