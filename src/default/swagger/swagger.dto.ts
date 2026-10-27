import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SwaggerErrorResponseDto {
  @ApiProperty({ example: false })
  status!: boolean;

  @ApiProperty({ example: 400 })
  code!: number;

  @ApiProperty({ example: "VALIDATION_FAILED" })
  errorCode!: string;

  @ApiProperty({ example: "Validation failed" })
  message!: string;

  @ApiPropertyOptional({ nullable: true, type: Object })
  data?: unknown;

  @ApiProperty({ example: "2026-09-13T10:30:00.000Z" })
  timestamp!: string;

  @ApiProperty({ example: "/api/v1/orders" })
  path!: string;

  @ApiPropertyOptional({ nullable: true, example: "123" })
  sub?: string | null;

  @ApiPropertyOptional({ nullable: true, example: "journey_c70477c9" })
  journeyId?: string | null;
}
