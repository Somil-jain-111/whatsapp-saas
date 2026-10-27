import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ErrorListQueryDto } from "../dto/whatsapp-integration.dto";
import { PhaseOneAuthGuard } from "../guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../guards/tenant-permission.guard";
import { TenantRequest } from "../interfaces/request-context.interface";
import { IntegrationHealthService } from "../services/integration-health.service";

@Controller("integrations")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
@RequireWhatsappPermission("whatsapp.integration.health.read")
export class IntegrationHealthController {
  constructor(private readonly healthService: IntegrationHealthService) {}

  @Get("health")
  health(@Req() request: TenantRequest) {
    return this.healthService.health(request.organizationId);
  }

  @Get("errors")
  errors(@Req() request: TenantRequest, @Query() query: ErrorListQueryDto) {
    return this.healthService.errors(request.organizationId, query.limit);
  }
}
