import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UploadBase64ChunkDto {
  @IsString()
  @IsNotEmpty()
  uploadId: string;

  @IsString()
  @IsNotEmpty()
  chunkBase64: string;

  @IsInt()
  @Min(0)
  chunkIndex: number;

  @IsInt()
  @Min(1)
  totalChunks: number;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsString()
  @IsOptional()
  folder?: string;

  @IsBoolean()
  @IsOptional()
  isLastChunk?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
