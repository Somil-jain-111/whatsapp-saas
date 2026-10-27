import {
  IsEmail,
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
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { IsStrongPassword } from "../../../default/common/validators/is-strong-password.validator";

export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional()
  @IsIn(["CUSTOMER", "PLATFORM_ADMIN"])
  audience = "CUSTOMER";
  @IsOptional() @IsString() @Length(6, 6) mfaCode?: string;
}

export class CreateOrganizationDto {
  @IsString() @Length(1, 200) name!: string;
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(100)
  slug!: string;
  @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsString() @Length(1, 64) timezone!: string;
}

export class RegisterDto extends CreateOrganizationDto {
  @IsString() @Length(1, 150) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MaxLength(128) @IsStrongPassword() password!: string;
}

export class VerifyEmailDto {
  @IsString() @Length(32, 512) token!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class ResendVerificationDto {
  @IsEmail() @MaxLength(254) email!: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email!: string;
}

export class ResetPasswordDto {
  @IsString() @Length(32, 512) token!: string;
  @IsString() @MaxLength(128) @IsStrongPassword() password!: string;
}

export class AcceptInvitationDto {
  @IsString() @Length(32, 512) token!: string;
  @IsString() @Length(1, 150) fullName!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  refreshToken?: string;
}

export class CreateInvitationDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsUUID() roleId!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays = 7;
}

export class RevokeSessionDto {
  @IsOptional()
  @IsString()
  @Length(3, 100)
  reason = "Revoked by user";
}

export class WorkspaceListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class UpdateMemberDto {
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional() @IsIn(["ACTIVE", "SUSPENDED"]) status?: string;
}

export class MfaSetupDto {
  @IsString() @Length(1, 100) name!: string;
}

export class MfaVerifyDto {
  @IsUUID() factorId!: string;
  @IsString() @Length(6, 6) code!: string;
}

export class MfaRevokeDto {
  @IsString() @Length(8, 128) password!: string;
  @IsOptional() @IsString() @Length(6, 6) code?: string;
}
