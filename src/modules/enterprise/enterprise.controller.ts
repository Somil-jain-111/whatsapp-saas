import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { PlatformAdminGuard } from "../platform-admin/guards/platform-admin.guard";
import { PlatformAdminService } from "../platform-admin/platform-admin.service";
import {
  CreateIncidentDto,
  CreatePrivacyRequestDto,
  CreateSsoDto,
  RecordBackupVerificationDto,
  ReviewPrivacyRequestDto,
  RevokeEnterpriseSessionsDto,
  UpdateIncidentDto,
  UpdateRetentionPolicyDto,
  UpdateSecurityPolicyDto,
  UpdateSsoDto,
} from "./dto/enterprise.dto";
import { EnterpriseService } from "./enterprise.service";

@Controller("enterprise")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class EnterpriseController {
  constructor(private readonly service: EnterpriseService) {}

  @Get("security-policy")
  @RequireWhatsappPermission("enterprise.security.read")
  policy(@Req() request: TenantRequest) {
    return this.service.policy(request.organizationId);
  }

  @Patch("security-policy")
  @RequireWhatsappPermission("enterprise.security.manage")
  updatePolicy(
    @Req() request: TenantRequest,
    @Body() dto: UpdateSecurityPolicyDto,
  ) {
    return this.service.updatePolicy(
      request.organizationId,
      request.user.id,
      dto,
    );
  }

  @Get("sso")
  @RequireWhatsappPermission("enterprise.security.read")
  sso(@Req() request: TenantRequest) {
    return this.service.sso(request.organizationId);
  }

  @Post("sso")
  @RequireWhatsappPermission("enterprise.security.manage")
  createSso(@Req() request: TenantRequest, @Body() dto: CreateSsoDto) {
    return this.service.createSso(request.organizationId, request.user.id, dto);
  }

  @Patch("sso/:id")
  @RequireWhatsappPermission("enterprise.security.manage")
  updateSso(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSsoDto,
  ) {
    return this.service.updateSso(
      request.organizationId,
      request.user.id,
      id,
      dto,
    );
  }

  @Post("sso/:id/test")
  @RequireWhatsappPermission("enterprise.security.manage")
  testSso(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.testSso(request.organizationId, id);
  }

  @Delete("sso/:id")
  @RequireWhatsappPermission("enterprise.security.manage")
  deleteSso(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteSso(request.organizationId, request.user.id, id);
  }

  @Get("sessions")
  @RequireWhatsappPermission("enterprise.security.read")
  sessions(@Req() request: TenantRequest) {
    return this.service.sessions(request.organizationId);
  }

  @Post("sessions/revoke")
  @RequireWhatsappPermission("enterprise.security.manage")
  revokeSessions(
    @Req() request: TenantRequest,
    @Body() dto: RevokeEnterpriseSessionsDto,
  ) {
    return this.service.revokeSessions(
      request.organizationId,
      request.user.id,
      dto,
    );
  }

  @Get("retention-policies")
  @RequireWhatsappPermission("retention.read")
  retention(@Req() request: TenantRequest) {
    return this.service.retention(request.organizationId);
  }

  @Patch("retention-policies/:id")
  @RequireWhatsappPermission("retention.manage")
  updateRetention(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetentionPolicyDto,
  ) {
    return this.service.updateRetention(
      request.organizationId,
      request.user.id,
      id,
      dto,
    );
  }

  @Get("deletion-jobs")
  @RequireWhatsappPermission("retention.read")
  deletionJobs(@Req() request: TenantRequest) {
    return this.service.deletionJobs(request.organizationId);
  }

  @Get("residency")
  @RequireWhatsappPermission("enterprise.security.read")
  residency(@Req() request: TenantRequest) {
    return this.service.residency(request.organizationId);
  }
}

@Controller("privacy")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class PrivacyController {
  constructor(private readonly service: EnterpriseService) {}

  @Post("requests")
  @RequireWhatsappPermission("privacy.requests.manage")
  create(@Req() request: TenantRequest, @Body() dto: CreatePrivacyRequestDto) {
    return this.service.createPrivacy(
      request.organizationId,
      request.user.id,
      dto,
    );
  }

  @Get("requests")
  @RequireWhatsappPermission("privacy.requests.read")
  list(@Req() request: TenantRequest) {
    return this.service.privacy(request.organizationId);
  }

  @Get("requests/:id")
  @RequireWhatsappPermission("privacy.requests.read")
  get(@Req() request: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.privacyRequest(request.organizationId, id);
  }
}

@Controller("internal/admin/v1")
@UseGuards(PhaseOneAuthGuard, PlatformAdminGuard)
export class EnterpriseAdminController {
  constructor(
    private readonly service: EnterpriseService,
    private readonly platform: PlatformAdminService,
  ) {}

  @Get("platform/health")
  health() {
    return this.service.platformHealth();
  }
  @Get("platform/metrics")
  metrics() {
    return this.service.platformHealth();
  }
  @Get("platform/queues")
  queues() {
    return this.platform.queueHealth();
  }
  @Get("platform/incidents")
  incidents() {
    return this.service.incidents();
  }
  @Post("platform/incidents")
  createIncident(@Req() request: any, @Body() dto: CreateIncidentDto) {
    return this.service.createIncident(request.platformAdmin, dto);
  }
  @Patch("platform/incidents/:id")
  updateIncident(
    @Req() request: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.service.updateIncident(request.platformAdmin, id, dto);
  }
  @Get("privacy/requests")
  privacy() {
    return this.service.adminPrivacy();
  }
  @Post("privacy/requests/:id/review")
  reviewPrivacy(
    @Req() request: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewPrivacyRequestDto,
  ) {
    return this.service.reviewPrivacy(request.platformAdmin, id, dto);
  }
  @Get("tenants/security")
  security() {
    return this.service.tenantSecurity();
  }
  @Get("tenants/residency")
  residency() {
    return this.service.tenantResidency();
  }
  @Get("platform/backups")
  backups() {
    return this.service.backups();
  }
  @Post("platform/backups")
  recordBackup(@Req() request: any, @Body() dto: RecordBackupVerificationDto) {
    return this.service.recordBackup(request.platformAdmin, dto);
  }
  @Get("platform/audit-logs")
  audit() {
    return this.service.platformAudit();
  }
}
