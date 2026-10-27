import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ValidateIf,
} from "class-validator";

export const API_SCOPES = [
  "messages:send",
  "messages:read",
  "templates:read",
  "contacts:read",
  "contacts:write",
  "campaigns:read",
  "campaigns:manage",
  "reports:read",
  "webhooks:manage",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export class CreateApiKeyDto {
  @IsString() @Length(1, 100) name!: string;
  @IsIn(["LIVE", "TEST"]) environment!: "LIVE" | "TEST";
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(API_SCOPES.length)
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true })
  scopes!: ApiScope[];
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @Matches(/^([0-9a-fA-F:.]+)(\/\d{1,3})?$/, { each: true })
  ipAllowlist: string[] = [];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @Matches(/^(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/, { each: true })
  mtlsFingerprints: string[] = [];
}

export class RotateApiKeyDto {
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class RevokeApiKeyDto {
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

export class ListApiLogsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(160) endpoint?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(599)
  status?: number;
  @IsOptional() @IsUUID() requestId?: string;
}

export class PublicTemplateMessageDto {
  @Matches(/^\+[1-9][0-9]{1,14}$/) to!: string;
  @IsUUID() sender_id!: string;
  @IsUUID() template_id!: string;
  @IsString() @MaxLength(20) language!: string;
  @IsObject() parameters: Record<string, string> = {};
  @IsOptional() @IsIn(["delivered", "read", "failed"]) scenario = "delivered";
}

export class PublicBulkMessageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PublicTemplateMessageDto)
  messages!: PublicTemplateMessageDto[];
}

export class PublicListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export const WEBHOOK_EVENTS = [
  "message.accepted",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "campaign.started",
  "campaign.completed",
  "campaign.failed",
] as const;

export class CreateWebhookDto {
  @IsString() @Length(1, 100) name!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) url!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WEBHOOK_EVENTS.length)
  @ArrayUnique()
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events!: string[];
}

export class WebhookTestDto {
  @IsOptional() @IsIn(WEBHOOK_EVENTS) eventType = "message.accepted";
}

export class ApiStatusDto {
  @Transform(({ value }) => String(value).toLowerCase() === "true")
  @IsIn([true, false])
  enabled!: boolean;
}

export class OAuthTokenDto {
  @IsIn(["client_credentials"])
  grant_type!: "client_credentials";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;
}

export class UpdateSpendingCapDto {
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number | null;
}
