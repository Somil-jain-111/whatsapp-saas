import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  HttpCode,
  HttpStatus,
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
import { CampaignsService } from "./campaigns.service";
import { CampaignListDto, CreateCampaignDto } from "./dto/campaign.dto";
@Controller("campaigns")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}
  @Post() @RequireWhatsappPermission("campaigns.manage") create(
    @Req() r: TenantRequest,
    @Body() d: CreateCampaignDto,
  ) {
    return this.service.create(r.organizationId, r.user.id, d);
  }
  @Get() @RequireWhatsappPermission("campaigns.read") list(
    @Req() r: TenantRequest,
    @Query() d: CampaignListDto,
  ) {
    return this.service.list(r.organizationId, d);
  }
  @Get(":id") @RequireWhatsappPermission("campaigns.read") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.get(r.organizationId, i);
  }
  @Get(":id/recipients")
  @RequireWhatsappPermission("campaigns.read")
  recipients(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) i: string) {
    return this.service.recipients(r.organizationId, i);
  }
  @Get(":id/metrics") @RequireWhatsappPermission("campaigns.read") metrics(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.metrics(r.organizationId, i);
  }
  @Post(":id/validate") @RequireWhatsappPermission("campaigns.manage") validate(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.validate(r.organizationId, i);
  }
  @Post(":id/launch") @RequireWhatsappPermission("campaigns.manage") launch(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.transition(r.organizationId, i, "launch");
  }
  @Post(":id/pause") @RequireWhatsappPermission("campaigns.manage") pause(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.transition(r.organizationId, i, "pause");
  }
  @Post(":id/resume") @RequireWhatsappPermission("campaigns.manage") resume(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.transition(r.organizationId, i, "resume");
  }
  @Post(":id/cancel") @RequireWhatsappPermission("campaigns.manage") cancel(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) i: string,
  ) {
    return this.service.transition(r.organizationId, i, "cancel");
  }
}

@Controller("messages")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class BulkMessagesController {
  constructor(private readonly service: CampaignsService) {}

  @Post("bulk")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireWhatsappPermission("messages.send")
  bulk(@Req() request: TenantRequest, @Body() dto: CreateCampaignDto) {
    return this.service.createAndLaunch(
      request.organizationId,
      request.user.id,
      dto,
    );
  }
}
