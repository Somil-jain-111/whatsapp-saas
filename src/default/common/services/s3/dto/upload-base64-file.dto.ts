import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UploadBase64FileDto {
  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  folder?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
