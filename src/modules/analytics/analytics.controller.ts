import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto, JourneyEventDto } from "./dto/analytics-query.dto";
@Controller("analytics")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
@RequireWhatsappPermission("analytics.read")
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}
  @Post("journey-events")
  recordJourney(@Req() r: TenantRequest, @Body() dto: JourneyEventDto) {
    return this.service.recordJourney(
      r.organizationId,
      r.user.id,
      r.user.sessionId,
      dto,
    );
  }
  @Get("overview") overview(
    @Req() r: TenantRequest,
    @Query() q: AnalyticsQueryDto,
  ) {
    return this.service.overview(r.organizationId, q);
  }
  @Get("campaigns") campaigns(
    @Req() r: TenantRequest,
    @Query() q: AnalyticsQueryDto,
  ) {
    return this.service.campaigns(r.organizationId, q);
  }
  @Get("campaigns/:id") async campaign(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.campaign(r.organizationId, i);
  }
  @Get("templates") templates(
    @Req() r: TenantRequest,
    @Query() q: AnalyticsQueryDto,
  ) {
    return this.service.templates(r.organizationId, q);
  }
  @Get("messages") messages(
    @Req() r: TenantRequest,
    @Query() q: AnalyticsQueryDto,
  ) {
    return this.service.messages(r.organizationId, q);
  }
  @Get("costs") costs(@Req() r: TenantRequest, @Query() q: AnalyticsQueryDto) {
    return this.service.costs(r.organizationId, q);
  }
}
