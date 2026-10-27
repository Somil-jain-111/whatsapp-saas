import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class CampaignRecipientDto {
  @IsUUID() contactId!: string;
  @IsOptional() @IsObject() parameters: Record<string, unknown> = {};
}
export class CreateCampaignDto {
  @IsString() @Length(1, 150) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsUUID() senderId!: string;
  @IsUUID() templateId!: string;
  @IsOptional() @IsUUID() segmentId?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(64) timezone = "UTC";
  @IsArray()
  @ArrayMaxSize(10000)
  @ArrayUnique((r: CampaignRecipientDto) => r.contactId)
  @ValidateNested({ each: true })
  @Type(() => CampaignRecipientDto)
  recipients!: CampaignRecipientDto[];
}
export class CampaignListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}
