import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CheckoutDto {
  @IsUUID() priceId!: string;
}
export class StartTrialDto {
  @IsUUID() planId!: string;
}

export class ChangeSubscriptionDto {
  @IsUUID() priceId!: string;
}
export class CancelSubscriptionDto {
  @IsOptional() @IsBoolean() immediate = false;
}

export class UsageQueryDto {
  @IsString() @MinLength(3) @MaxLength(100) metric!: string;
}

export class ReportExportDto {
  @IsIn(["CAMPAIGN", "MESSAGES", "TEMPLATES", "USAGE", "BILLING", "PAYMENTS"])
  type!: string;
  @IsIn(["CSV", "XLSX", "PDF"]) format!: string;
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
  @IsOptional() @IsUUID() senderId?: string;
  @IsOptional() @IsUUID() campaignId?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() @IsString() @MaxLength(30) status?: string;
}
