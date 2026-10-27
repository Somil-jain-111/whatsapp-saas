import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateSecurityPolicyDto {
  @IsOptional() @IsBoolean() requireMfa?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(43200)
  sessionLifetimeMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  idleTimeoutMinutes?: number;
  @IsOptional() @IsBoolean() passwordLoginEnabled?: boolean;
  @IsOptional() @IsBoolean() supportAccessEnabled?: boolean;
}

export class CreateSsoDto {
  @IsString() @Length(1, 100) name!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  issuerUrl!: string;
  @IsString() @Length(1, 255) clientId!: string;
  @IsString() @Length(8, 2048) clientSecret!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  redirectUri!: string;
  @IsArray() @IsString({ each: true }) allowedDomains!: string[];
  @IsOptional() @IsBoolean() enabled = false;
}

export class UpdateSsoDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @Length(8, 2048) clientSecret?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedDomains?: string[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class CreatePrivacyRequestDto {
  @IsIn([
    "ACCESS",
    "EXPORT",
    "CORRECTION",
    "DELETION",
    "CONSENT_WITHDRAWAL",
    "RESTRICTION",
  ])
  requestType!: string;
  @IsIn(["USER", "CONTACT"]) subjectType!: string;
  @IsUUID() subjectId!: string;
  @IsIn(["GDPR", "UK_GDPR", "DPDP", "CCPA", "LGPD", "OTHER"])
  jurisdiction!: string;
  @IsString() @Length(8, 128) password!: string;
}

export class UpdateRetentionPolicyDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(3650) retentionDays!: number;
  @IsString() @Length(3, 500) legalBasis!: string;
  @IsIn(["DELETE", "ANONYMIZE"]) deletionMethod!: string;
  @IsBoolean() legalHold!: boolean;
}

export class RevokeEnterpriseSessionsDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsString() @Length(3, 100) reason!: string;
}

export class CreateIncidentDto {
  @IsOptional() @IsUUID() organizationId?: string;
  @IsString() @Length(3, 200) title!: string;
  @IsIn(["LOW", "MEDIUM", "HIGH", "CRITICAL"]) severity!: string;
  @IsString() @Length(2, 50) category!: string;
  @IsString() @Length(3, 2000) summary!: string;
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsIn(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"])
  status?: string;
  @IsOptional() @IsUUID() assignedPlatformAdminId?: string;
  @IsString() @Length(3, 2000) note!: string;
}

export class ReviewPrivacyRequestDto {
  @IsIn([
    "IN_REVIEW",
    "APPROVED",
    "REJECTED",
    "PROCESSING",
    "COMPLETED",
    "CANCELLED",
  ])
  status!: string;
  @IsString() @Length(3, 1000) reason!: string;
}

export class RecordBackupVerificationDto {
  @IsIn(["GLOBAL", "EU", "UK", "IN", "US", "BR", "APAC"])
  region!: string;
  @IsString() @Length(3, 255) backupReference!: string;
  @IsIn(["FULL", "PITR", "OBJECT_STORAGE", "SECRETS"]) backupType!: string;
  @IsIn(["PASSED", "FAILED"]) status!: string;
  @IsOptional() @IsString() @MaxLength(500) evidenceReference?: string;
}

export class CreateSupportGrantDto {
  @IsUUID() platformAdminId!: string;
  @IsString() @Length(3, 100) ticketReference!: string;
  @IsString() @Length(3, 500) purpose!: string;
  @IsArray()
  @IsIn(["DIAGNOSTICS", "CONFIGURATION", "AUDIT_READ"], { each: true })
  scopes!: string[];
  @Type(() => Number) @IsInt() @Min(5) @Max(1440) durationMinutes!: number;
}
