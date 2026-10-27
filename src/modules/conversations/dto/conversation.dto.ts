import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { InteractiveMessage } from "../../messaging/interactive-message";

export class ConversationListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
  @IsOptional()
  @IsIn(["OPEN", "PENDING", "RESOLVED", "CLOSED"])
  status?: string;
  @IsOptional() @IsUUID() agentId?: string;
  @IsOptional() @IsUUID() senderId?: string;
  @IsOptional() @IsUUID() labelId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsIn(["OPEN", "PENDING", "RESOLVED", "CLOSED"])
  status?: string;
  @IsOptional() @IsIn(["LOW", "NORMAL", "HIGH", "URGENT"]) priority?: string;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class AssignConversationDto {
  @IsUUID() userId!: string;
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
}

export class VersionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class SendConversationMessageDto {
  @IsIn(["TEXT", "TEMPLATE", "IMAGE", "DOCUMENT", "VIDEO", "INTERACTIVE"])
  type!: "TEXT" | "TEMPLATE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "INTERACTIVE";
  @IsOptional() @IsString() @MaxLength(4096) text?: string;
  @IsOptional() @IsObject() interactive?: InteractiveMessage;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(20) language?: string;
  @IsOptional() parameters: Record<string, string> = {};
  @IsOptional() @IsString() @MaxLength(1024) mediaObjectKey?: string;
  @IsOptional() @IsString() @MaxLength(100) mediaMimeType?: string;
  @IsOptional() @IsString() @MaxLength(255) mediaFileName?: string;
  @IsString() @Length(1, 255) idempotencyKey!: string;
}

export class CreateNoteDto {
  @IsString() @Length(1, 10000) body!: string;
}

export class UpdateNoteDto extends CreateNoteDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class CreateLabelDto {
  @IsString() @Length(1, 100) name!: string;
  @Matches(/^#[0-9a-fA-F]{6}$/) color!: string;
}

export class UpdateLabelDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}

export class AssignLabelsDto {
  @IsArray() @IsUUID(undefined, { each: true }) labelIds!: string[];
}

export class SavedReplyDto {
  @IsString() @Length(1, 100) name!: string;
  @Matches(/^\/[a-z0-9_-]{1,49}$/) shortcut!: string;
  @IsString() @Length(1, 4096) content!: string;
  @IsString() @Length(2, 20) language!: string;
}

export class AvailabilityDto {
  @IsIn(["ONLINE", "AWAY", "BUSY", "OFFLINE"]) status!: string;
}

export class RealtimeQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) cursor = 0;
}

export class InboxSettingsDto {
  @IsOptional() @IsUUID() defaultSenderId?: string;
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  notificationsEnabled!: boolean;
  @Type(() => Number) @IsInt() @Min(30) @Max(2555) retentionDays!: number;
}
