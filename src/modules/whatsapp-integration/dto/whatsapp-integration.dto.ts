import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CompleteOnboardingDto {
  @IsString() @MinLength(16) @MaxLength(2048) state!: string;
  @IsString() @MinLength(4) @MaxLength(4096) code!: string;
  @IsString() @Matches(/^\d{1,64}$/) wabaId!: string;
}

export class SaveMetaAppConfigurationDto {
  @IsString() @Matches(/^\d{1,64}$/) appId!: string;
  @IsString() @MinLength(16) @MaxLength(255) appSecret!: string;
  @IsString() @Matches(/^\d{1,64}$/) configurationId!: string;
  @IsString() @Matches(/^v\d+\.\d+$/) graphApiVersion!: string;
}

export class DisconnectConnectionDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export { TemplateComponentDto } from "./template-component.dto";
import { TemplateComponentDto } from "./template-component.dto";

export class SaveTemplateDto {
  @IsUUID() accountId!: string;
  @IsString() @Matches(/^[a-z0-9_]+$/) @MaxLength(512) name!: string;
  @IsString() @Matches(/^[A-Za-z]{2,3}([_-][A-Za-z]{2})?$/) language!: string;
  @IsIn(["MARKETING", "UTILITY", "AUTHENTICATION"]) category!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => TemplateComponentDto)
  components!: TemplateComponentDto[];
}

export class DuplicateTemplateDto {
  @IsString() @Matches(/^[a-z0-9_]+$/) @MaxLength(512) name!: string;
}

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
}

export class ErrorListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
