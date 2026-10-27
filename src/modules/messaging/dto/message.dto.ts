import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { InteractiveMessage } from "../interactive-message";
export class SendTemplateMessageDto {
  @IsOptional() @IsUUID() contactId?: string;
  @IsOptional() @Matches(/^\+[1-9][0-9]{1,14}$/) recipientPhone?: string;
  @IsUUID() senderId!: string;
  @IsUUID() templateId!: string;
  @IsString() @MaxLength(20) language!: string;
  @IsObject() parameters: Record<string, string> = {};
  @IsOptional() @IsString() @MaxLength(255) idempotencyKey?: string;
}

export class MessageListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
  @IsOptional() @IsUUID() campaignId?: string;
}

export interface ConversationReplyInput {
  conversationId: string;
  contactId: string;
  recipientPhone: string;
  senderId: string;
  agentUserId: string;
  type: "TEXT" | "TEMPLATE" | "IMAGE" | "DOCUMENT" | "VIDEO" | "INTERACTIVE";
  text?: string;
  interactive?: InteractiveMessage;
  templateId?: string;
  language?: string;
  parameters: Record<string, string>;
  mediaObjectKey?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  idempotencyKey: string;
}
