import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  CreateAdminPlanDto,
  CreateBillingAdjustmentDto,
  UpdateAdminPlanDto,
  AdminCustomerListDto,
  AdminApiStatusDto,
} from "./dto/platform-admin.dto";
import { PlatformAdminGuard } from "./guards/platform-admin.guard";
import { PlatformAdminService } from "./platform-admin.service";

@Controller("internal/admin/v1")
@UseGuards(PhaseOneAuthGuard, PlatformAdminGuard)
export class PlatformAdminController {
  constructor(private readonly service: PlatformAdminService) {}
  @Get("overview") overview() {
    return this.service.overview();
  }
  @Get("customers") customers(@Query() dto: AdminCustomerListDto) {
    return this.service.customers(dto);
  }
  @Get("customers/:id") customer(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.customer(id);
  }
  @Get("customers/:id/audit-logs") customerAudit(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() dto: AdminCustomerListDto,
  ) {
    return this.service.customerAudit(id, dto);
  }
  @Get("customers/:id/journey") customerJourney(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() dto: AdminCustomerListDto,
  ) {
    return this.service.customerJourney(id, dto);
  }
  @Get("billing/overview") billingOverview() {
    return this.service.billingOverview();
  }
  @Get("billing/subscriptions") subscriptions() {
    return this.service.subscriptions();
  }
  @Get("billing/payments") payments() {
    return this.service.payments();
  }
  @Get("billing/invoices") invoices() {
    return this.service.invoices();
  }
  @Get("billing/revenue") revenue() {
    return this.service.revenue();
  }
  @Get("usage/overview") usage() {
    return this.service.usage();
  }
  @Get("analytics/platform") analytics() {
    return this.service.analytics();
  }
  @Get("api/overview") apiOverview() {
    return this.service.apiOverview();
  }
  @Get("api/keys") apiKeys() {
    return this.service.apiKeys();
  }
  @Get("api/security-events") apiSecurityEvents() {
    return this.service.apiSecurityEvents();
  }
  @Patch("api/tenants/:id/status") tenantApiStatus(
    @Req() request: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AdminApiStatusDto,
  ) {
    return this.service.setTenantApiStatus(
      id,
      dto.enabled,
      request.platformAdmin,
    );
  }
  @Post("api/keys/:id/emergency-revoke") emergencyRevoke(
    @Req() request: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.emergencyRevokeKey(id, request.platformAdmin);
  }
  @Post("plans") createPlan(@Body() dto: CreateAdminPlanDto) {
    return this.service.createPlan(dto);
  }
  @Patch("plans/:id") updatePlan(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminPlanDto,
  ) {
    return this.service.updatePlan(id, dto);
  }
  @Post("billing/adjustments") adjustment(
    @Req() request: any,
    @Body() dto: CreateBillingAdjustmentDto,
  ) {
    return this.service.adjustment(request.platformAdmin.id, dto);
  }
  @Get("meta/connections") metaConnections() {
    return this.service.metaConnections();
  }
  @Get("meta/health") metaHealth() {
    return this.service.metaHealth();
  }
  @Get("meta/errors") metaErrors() {
    return this.service.metaErrors();
  }
  @Get("templates") templates() {
    return this.service.templates();
  }
  @Get("templates/metrics") templateMetrics() {
    return this.service.templateMetrics();
  }
  @Get("reports/exports") reportJobs() {
    return this.service.reportJobs();
  }
  @Get("queues/health") queueHealth() {
    return this.service.queueHealth();
  }
  @Get("inbox/health") inboxHealth() {
    return this.service.inboxHealth();
  }
}
