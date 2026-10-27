import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PlatformAdminGuard } from "../platform-admin/guards/platform-admin.guard";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { AutomationsService } from "./automations.service";
import {
  ChatbotRuleDto,
  CreateWorkflowDto,
  CredentialDto,
  ExecutionListDto,
  ExternalAutomationEventDto,
  ListWorkflowDto,
  SandboxDto,
  UpdateWorkflowDto,
} from "./dto/automation.dto";

@Controller("workflows")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class WorkflowsController {
  constructor(private readonly service: AutomationsService) {}
  @Post() @RequireWhatsappPermission("automations.write") create(
    @Req() r: TenantRequest,
    @Body() b: CreateWorkflowDto,
  ) {
    return this.service.create(r.organizationId, r.user.id, b);
  }
  @Get() @RequireWhatsappPermission("automations.read") list(
    @Req() r: TenantRequest,
    @Query() q: ListWorkflowDto,
  ) {
    return this.service.list(r.organizationId, q);
  }
  @Get(":id") @RequireWhatsappPermission("automations.read") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.organizationId, id);
  }
  @Patch(":id") @RequireWhatsappPermission("automations.write") update(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateWorkflowDto,
  ) {
    return this.service.update(r.organizationId, id, r.user.id, b);
  }
  @Delete(":id") @RequireWhatsappPermission("automations.write") archive(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.archive(r.organizationId, id, r.user.id);
  }
  @Post(":id/validate")
  @RequireWhatsappPermission("automations.write")
  validate(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.validate(r.organizationId, id);
  }
  @Post(":id/publish")
  @RequireWhatsappPermission("automations.publish")
  publish(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.publish(r.organizationId, id, r.user.id);
  }
  @Post(":id/activate")
  @RequireWhatsappPermission("automations.publish")
  activate(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.setStatus(r.organizationId, id, r.user.id, "ACTIVE");
  }
  @Post(":id/pause") @RequireWhatsappPermission("automations.publish") pause(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.setStatus(r.organizationId, id, r.user.id, "PAUSED");
  }
  @Post(":id/duplicate")
  @RequireWhatsappPermission("automations.write")
  duplicate(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.duplicate(r.organizationId, id, r.user.id);
  }
  @Get(":id/versions") @RequireWhatsappPermission("automations.read") versions(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.versions(r.organizationId, id);
  }
  @Get(":id/versions/:version")
  @RequireWhatsappPermission("automations.read")
  version(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.service.version(r.organizationId, id, version);
  }
  @Get(":id/executions")
  @RequireWhatsappPermission("automations.read")
  executions(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: ExecutionListDto,
  ) {
    return this.service.executions(r.organizationId, id, q);
  }
  @Get(":id/analytics")
  @RequireWhatsappPermission("automations.read")
  analytics(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.analytics(r.organizationId, id);
  }
  @Post(":id/sandbox")
  @RequireWhatsappPermission("automations.execute")
  sandbox(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: SandboxDto,
  ) {
    return this.service.sandbox(r.organizationId, id, b);
  }
}

@Controller("workflow-executions")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class WorkflowExecutionsController {
  constructor(private readonly service: AutomationsService) {}
  @Get(":id") @RequireWhatsappPermission("automations.read") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.execution(r.organizationId, id);
  }
  @Get(":id/steps") @RequireWhatsappPermission("automations.read") steps(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.steps(r.organizationId, id);
  }
  @Post(":id/cancel") @RequireWhatsappPermission("automations.execute") cancel(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(r.organizationId, id, r.user.id);
  }
  @Post(":id/retry") @RequireWhatsappPermission("automations.execute") retry(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.retry(r.organizationId, id, r.user.id);
  }
}

@Controller("chatbot/rules")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class ChatbotRulesController {
  constructor(private readonly service: AutomationsService) {}
  @Post() @RequireWhatsappPermission("automations.write") create(
    @Req() r: TenantRequest,
    @Body() b: ChatbotRuleDto,
  ) {
    return this.service.createRule(r.organizationId, r.user.id, b);
  }
  @Get() @RequireWhatsappPermission("automations.read") list(
    @Req() r: TenantRequest,
  ) {
    return this.service.rules(r.organizationId);
  }
  @Patch(":id") @RequireWhatsappPermission("automations.write") update(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: ChatbotRuleDto,
  ) {
    return this.service.updateRule(r.organizationId, id, b);
  }
  @Delete(":id") @RequireWhatsappPermission("automations.write") remove(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteRule(r.organizationId, id);
  }
}

@Controller("automations")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class AutomationsController {
  constructor(private readonly service: AutomationsService) {}
  @Get("analytics") @RequireWhatsappPermission("automations.read") analytics(
    @Req() r: TenantRequest,
  ) {
    return this.service.analytics(r.organizationId);
  }
  @Post("events") @RequireWhatsappPermission("automations.execute") event(
    @Req() r: TenantRequest,
    @Body() body: ExternalAutomationEventDto,
  ) {
    return this.service.trigger(r.organizationId, {
      externalId: body.eventId,
      type: body.eventType,
      sourceType: "API",
      payload: body.payload,
      occurredAt: body.timestamp ? new Date(body.timestamp) : new Date(),
    });
  }
  @Post("credentials")
  @RequireWhatsappPermission("automations.credentials.manage")
  credential(@Req() r: TenantRequest, @Body() b: CredentialDto) {
    return this.service.createCredential(r.organizationId, r.user.id, b);
  }
}

@Controller("internal/admin/v1/automations")
@UseGuards(PhaseOneAuthGuard, PlatformAdminGuard)
export class AutomationsAdminController {
  constructor(private readonly service: AutomationsService) {}
  @Get("overview") overview() {
    return this.service.adminOverview();
  }
  @Get("executions") executions() {
    return this.service.adminExecutions();
  }
  @Get("failures") failures() {
    return this.service.adminExecutions(true);
  }
  @Post(":id/emergency-pause") pause(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.emergencyPause(id, r.user.id);
  }
}
