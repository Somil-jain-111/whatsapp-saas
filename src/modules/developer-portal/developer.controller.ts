import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { ApiKeyService } from "./api-key.service";
import { DeveloperDocumentationService } from "./developer-documentation.service";
import { DeveloperPortalService } from "./developer-portal.service";
import {
  CreateApiKeyDto,
  ListApiLogsDto,
  RevokeApiKeyDto,
  RotateApiKeyDto,
  UpdateSpendingCapDto,
} from "./dto/developer-portal.dto";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { ApiSpendingService } from "./api-spending.service";

@Controller("developer")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class DeveloperController {
  constructor(
    private readonly keys: ApiKeyService,
    private readonly portal: DeveloperPortalService,
    private readonly docs: DeveloperDocumentationService,
    private readonly spending: ApiSpendingService,
  ) {}

  @Get("overview")
  @RequireWhatsappPermission("developer.usage.read")
  overview(@Req() request: TenantRequest) {
    return this.portal.overview(request.organizationId);
  }

  @Get("spending-cap")
  @RequireWhatsappPermission("developer.usage.read")
  spendingCap(@Req() request: TenantRequest) {
    return this.spending.get(request.organizationId);
  }

  @Patch("spending-cap")
  @RequireWhatsappPermission("developer.api_key.manage")
  updateSpendingCap(
    @Req() request: TenantRequest,
    @Body() body: UpdateSpendingCapDto,
  ) {
    return this.spending.update(
      request.organizationId,
      request.user.id,
      body.amountMinor,
    );
  }

  @Get("api-keys")
  @RequireWhatsappPermission("developer.api_key.read")
  listKeys(@Req() request: TenantRequest) {
    return this.keys.list(request.organizationId);
  }

  @Post("api-keys")
  @RequireWhatsappPermission("developer.api_key.manage")
  createKey(@Req() request: TenantRequest, @Body() body: CreateApiKeyDto) {
    return this.keys.create(request.organizationId, request.user.id, body);
  }

  @Post("api-keys/:id/rotate")
  @RequireWhatsappPermission("developer.api_key.manage")
  rotateKey(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RotateApiKeyDto,
  ) {
    return this.keys.rotate(request.organizationId, request.user.id, id, body);
  }

  @Delete("api-keys/:id")
  @RequireWhatsappPermission("developer.api_key.manage")
  revokeKey(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RevokeApiKeyDto,
  ) {
    return this.keys.revoke(request.organizationId, request.user.id, id, body);
  }

  @Get("request-logs")
  @RequireWhatsappPermission("developer.usage.read")
  logs(@Req() request: TenantRequest, @Query() query: ListApiLogsDto) {
    return this.portal.requestLogs(request.organizationId, query);
  }

  @Get("code-samples")
  @RequireWhatsappPermission("developer.api_key.read")
  codeSamples(@Req() request: TenantRequest) {
    return this.docs.codeSamples(
      `${request.protocol}://${request.get("host")}`,
    );
  }

  @Get("openapi.json")
  @RequireWhatsappPermission("developer.api_key.read")
  openApi(@Req() request: TenantRequest, @Res() response: Response) {
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="relay-openapi.json"',
    );
    response.json(
      this.docs.openApi(`${request.protocol}://${request.get("host")}`),
    );
  }

  @Get("postman.json")
  @RequireWhatsappPermission("developer.api_key.read")
  postman(@Req() request: TenantRequest, @Res() response: Response) {
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="relay-postman.json"',
    );
    response.json(
      this.docs.postman(`${request.protocol}://${request.get("host")}`),
    );
  }
}
