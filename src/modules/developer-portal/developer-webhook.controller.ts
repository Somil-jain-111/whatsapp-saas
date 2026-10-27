import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { DeveloperWebhookService } from "./developer-webhook.service";
import { CreateWebhookDto, WebhookTestDto } from "./dto/developer-portal.dto";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";

@Controller("developer/webhooks")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
@RequireWhatsappPermission("developer.webhook.manage")
export class DeveloperWebhookController {
  constructor(private readonly webhooks: DeveloperWebhookService) {}

  @Get()
  list(@Req() request: TenantRequest) {
    return this.webhooks.list(request.organizationId);
  }

  @Post()
  create(@Req() request: TenantRequest, @Body() body: CreateWebhookDto) {
    return this.webhooks.create(request.organizationId, request.user.id, body);
  }

  @Post(":id/rotate-secret")
  rotate(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.webhooks.rotate(request.organizationId, request.user.id, id);
  }

  @Post(":id/test")
  test(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: WebhookTestDto,
  ) {
    return this.webhooks.test(request.organizationId, id, body.eventType);
  }

  @Get(":id/deliveries")
  deliveries(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.webhooks.deliveries(request.organizationId, id);
  }

  @Post("deliveries/:id/replay")
  replay(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.webhooks.replay(request.organizationId, id);
  }
}
