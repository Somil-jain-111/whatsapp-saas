import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class AdminPlanFeatureDto {
  @IsString() @Length(1, 100) code!: string;
  @IsBoolean() enabled = true;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) quota?: number;
}
class AdminPlanPriceDto {
  @IsOptional() @Matches(/^[A-Z]{2}$/) countryCode?: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @IsIn(["MONTH", "YEAR"]) interval!: string;
  @Type(() => Number) @IsInt() @Min(0) amountMinor!: number;
  @IsOptional() @IsIn(["STRIPE"]) provider?: string;
  @IsOptional() @IsString() @MaxLength(255) providerPriceId?: string;
  @IsOptional()
  @IsIn(["INCLUSIVE", "EXCLUSIVE", "UNSPECIFIED"])
  taxBehavior = "UNSPECIFIED";
}
export class CreateAdminPlanDto {
  @IsString() @Length(1, 50) code!: string;
  @IsString() @Length(1, 100) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(365) trialDays = 0;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder = 0;
  @IsDateString() effectiveFrom!: string;
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminPlanFeatureDto)
  features!: AdminPlanFeatureDto[];
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminPlanPriceDto)
  prices!: AdminPlanPriceDto[];
}
export class UpdateAdminPlanDto {
  @IsOptional() @IsString() @Length(1, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsIn(["ACTIVE", "INACTIVE"]) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
  @IsOptional() @IsDateString() effectiveTo?: string;
}
export class CreateBillingAdjustmentDto {
  @IsUUID() organizationId!: string;
  @IsOptional() @IsUUID() paymentId?: string;
  @IsIn(["CREDIT", "REFUND", "DEBIT"]) type!: string;
  @Matches(/^[A-Z]{3}$/) currency!: string;
  @Type(() => Number) @IsInt() @Min(1) amountMinor!: number;
  @IsString() @Length(1, 500) reason!: string;
  @IsOptional() @IsString() @MaxLength(255) providerReference?: string;
}

export class AdminCustomerListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class AdminApiStatusDto {
  @IsBoolean() enabled!: boolean;
}
