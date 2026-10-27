import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthResponse } from "../../default/common/decorators/auth-response.decorator";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  ForgotPasswordDto,
  LoginDto,
  MfaRevokeDto,
  MfaSetupDto,
  MfaVerifyDto,
  RegisterDto,
  RefreshDto,
  ResendVerificationDto,
  ResetPasswordDto,
  RevokeSessionDto,
  UpdateMemberDto,
  VerifyEmailDto,
  WorkspaceListDto,
} from "./dto/identity.dto";
import { IdentityService } from "./identity.service";

@Controller("auth")
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Post("login")
  @AuthResponse()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    return this.withRefreshCookie(
      await this.identity.login(dto, ip, userAgent),
      response!,
    );
  }

  @Post("register")
  @AuthResponse()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  register(@Body() dto: RegisterDto, @Ip() ip: string) {
    return this.identity.register(dto, ip);
  }

  @Post("verify-email")
  @AuthResponse()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    return this.withRefreshCookie(
      await this.identity.verifyEmail(dto, ip, userAgent),
      response!,
    );
  }

  @Post("resend-verification")
  @AuthResponse()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.identity.resendVerification(dto);
  }

  @Post("forgot-password")
  @AuthResponse()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.identity.forgotPassword(dto);
  }

  @Post("reset-password")
  @AuthResponse()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  resetPassword(@Body() dto: ResetPasswordDto, @Ip() ip: string) {
    return this.identity.resetPassword(dto, ip);
  }

  @Post("invitations/accept")
  @AuthResponse()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
    @Res({ passthrough: true }) response?: Response,
  ) {
    return this.withRefreshCookie(
      await this.identity.acceptInvitation(dto, ip, userAgent),
      response!,
    );
  }

  @Post("refresh")
  @AuthResponse()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken ?? request.cookies?.relay_refresh;
    const result = await this.identity.refresh({ refreshToken });
    return this.withRefreshCookie(result, response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PhaseOneAuthGuard)
  async logout(
    @Req() request: TenantRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.identity.logout(request.user.sessionId);
    response.clearCookie("relay_refresh", { path: "/" });
  }

  @Get("me")
  @UseGuards(PhaseOneAuthGuard)
  me(@Req() request: TenantRequest) {
    return this.identity.me(request.user.id);
  }

  @Get("sessions")
  @UseGuards(PhaseOneAuthGuard)
  sessions(@Req() request: TenantRequest) {
    return this.identity.sessions(request.user.id);
  }

  @Get("mfa")
  @UseGuards(PhaseOneAuthGuard)
  mfa(@Req() request: TenantRequest) {
    return this.identity.mfaFactors(request.user.id);
  }

  @Post("mfa/setup")
  @UseGuards(PhaseOneAuthGuard)
  setupMfa(@Req() request: TenantRequest, @Body() dto: MfaSetupDto) {
    return this.identity.setupMfa(request.user.id, dto);
  }

  @Post("mfa/verify")
  @UseGuards(PhaseOneAuthGuard)
  verifyMfa(@Req() request: TenantRequest, @Body() dto: MfaVerifyDto) {
    return this.identity.verifyMfa(
      request.user.id,
      request.user.sessionId,
      dto,
    );
  }

  @Post("mfa/:id/revoke")
  @UseGuards(PhaseOneAuthGuard)
  revokeMfa(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: MfaRevokeDto,
  ) {
    return this.identity.revokeMfa(request.user.id, id, dto);
  }

  @Post("sessions/:id/revoke")
  @UseGuards(PhaseOneAuthGuard)
  revoke(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RevokeSessionDto,
  ) {
    return this.identity.revokeSession(request.user.id, id, dto.reason);
  }

  @Post("organizations")
  @UseGuards(PhaseOneAuthGuard)
  createOrganization(
    @Req() request: TenantRequest,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.identity.createOrganization(request.user.id, dto);
  }

  private withRefreshCookie<T extends { refreshToken: string }>(
    result: T,
    response: Response,
  ): Omit<T, "refreshToken"> {
    response.cookie("relay_refresh", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const safe = { ...result } as T & { refreshToken?: string };
    delete safe.refreshToken;
    return safe;
  }
}

@Controller("workspace")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class WorkspaceController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @RequireWhatsappPermission("organization.read")
  workspace(@Req() request: TenantRequest) {
    return this.identity.workspace(request.organizationId);
  }

  @Get("members")
  @RequireWhatsappPermission("member.read")
  members(@Req() request: TenantRequest, @Query() query: WorkspaceListDto) {
    return this.identity.members(request.organizationId, query.limit);
  }

  @Patch("members/:id")
  @RequireWhatsappPermission("member.manage")
  updateMember(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.identity.updateMember(request.organizationId, id, dto);
  }

  @Get("roles")
  @RequireWhatsappPermission("role.read")
  roles(@Req() request: TenantRequest) {
    return this.identity.roles(request.organizationId);
  }

  @Get("invitations")
  @RequireWhatsappPermission("member.read")
  invitations(@Req() request: TenantRequest, @Query() query: WorkspaceListDto) {
    return this.identity.invitations(request.organizationId, query.limit);
  }

  @Post("invitations")
  @AuthResponse()
  @RequireWhatsappPermission("member.invite")
  invite(@Req() request: TenantRequest, @Body() dto: CreateInvitationDto) {
    return this.identity.invite(request.organizationId, request.user.id, dto);
  }

  @Get("security-events")
  @RequireWhatsappPermission("security.read")
  securityEvents(
    @Req() request: TenantRequest,
    @Query() query: WorkspaceListDto,
  ) {
    return this.identity.securityEvents(request.organizationId, query.limit);
  }

  @Get("audit-logs")
  @RequireWhatsappPermission("audit.read")
  auditLogs(@Req() request: TenantRequest, @Query() query: WorkspaceListDto) {
    return this.identity.auditLogs(request.organizationId, query.limit);
  }
}
