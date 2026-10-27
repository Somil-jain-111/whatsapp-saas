import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
export class AnalyticsQueryDto {
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsUUID() senderId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() templateId?: string;
}

export class JourneyEventDto {
  @IsIn(["PAGE_VIEW", "BILLING_RETURNED", "BILLING_CANCELLED"])
  eventType!: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^\/[A-Za-z0-9_./:-]*$/)
  path!: string;
}
