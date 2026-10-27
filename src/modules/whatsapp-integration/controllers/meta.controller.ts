import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CompleteOnboardingDto,
  DisconnectConnectionDto,
} from "../dto/whatsapp-integration.dto";
import { PhaseOneAuthGuard } from "../guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../guards/tenant-permission.guard";
import { TenantRequest } from "../interfaces/request-context.interface";
import { MetaOnboardingService } from "../services/meta-onboarding.service";

@Controller("meta")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class MetaController {
  constructor(private readonly onboarding: MetaOnboardingService) {}

  @Get("app-configuration")
  @RequireWhatsappPermission("meta.integration.read")
  appConfiguration(@Req() request: TenantRequest) {
    return this.onboarding.appConfiguration(request.organizationId);
  }

  @Post("onboarding/session")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequireWhatsappPermission("meta.integration.manage")
  start(@Req() request: TenantRequest) {
    return this.onboarding.start(request.organizationId, request.user.id);
  }

  @Post("onboarding/complete")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequireWhatsappPermission("meta.integration.manage")
  complete(@Req() request: TenantRequest, @Body() body: CompleteOnboardingDto) {
    return this.onboarding.complete(
      request.organizationId,
      request.user.id,
      body,
    );
  }

  @Get("connections")
  @RequireWhatsappPermission("meta.integration.read")
  list(@Req() request: TenantRequest) {
    return this.onboarding.list(request.organizationId);
  }

  @Get("connections/:id")
  @RequireWhatsappPermission("meta.integration.read")
  get(@Req() request: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.onboarding.get(request.organizationId, id);
  }

  @Post("connections/:id/sync")
  @HttpCode(202)
  @RequireWhatsappPermission("meta.integration.manage")
  sync(@Req() request: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.onboarding.sync(request.organizationId, id);
  }

  @Delete("connections/:id")
  @HttpCode(204)
  @RequireWhatsappPermission("meta.integration.manage")
  async disconnect(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: DisconnectConnectionDto,
  ): Promise<void> {
    await this.onboarding.disconnect(
      request.organizationId,
      request.user.id,
      id,
      body.reason,
    );
  }
}
