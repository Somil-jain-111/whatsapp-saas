import { Type } from "class-transformer";
import {
  IsEmail,
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

export class ContactListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(150) search?: string;
  @IsOptional() @IsIn(["ACTIVE", "SUPPRESSED", "DELETED"]) status?: string;
}

export class CreateContactDto {
  @IsString() @Length(1, 150) fullName!: string;
  @IsString() @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsString() @Matches(/^\+[1-9][0-9]{1,14}$/) phoneE164!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsObject() customAttributes: Record<string, unknown> = {};
  @IsOptional() @IsIn(["MANUAL", "IMPORT", "API"]) source = "MANUAL";
}

export class UpdateContactDto {
  @IsOptional() @IsString() @Length(1, 150) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsObject() customAttributes?: Record<string, unknown>;
  @IsOptional() @IsIn(["ACTIVE", "SUPPRESSED"]) status?: string;
}

export class ConsentDto {
  @IsUUID() contactId!: string;
  @IsIn(["TRANSACTIONAL", "MARKETING"]) purpose!: string;
  @IsIn(["OPTED_IN", "OPTED_OUT"]) status!: string;
  @IsString() @Length(1, 50) source!: string;
  @IsString() @Length(1, 50) policyVersion!: string;
  @IsOptional() @IsString() @MaxLength(500) evidenceReference?: string;
}

export class CreateTagDto {
  @IsString() @Length(1, 100) name!: string;
}

export class CreateSegmentDto {
  @IsString() @Length(1, 100) name!: string;
  @IsObject() definition!: Record<string, unknown>;
}
