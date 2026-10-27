import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  DuplicateTemplateDto,
  ListQueryDto,
  SaveTemplateDto,
} from "../dto/whatsapp-integration.dto";
import { PhaseOneAuthGuard } from "../guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../guards/tenant-permission.guard";
import { TenantRequest } from "../interfaces/request-context.interface";
import { TemplateService } from "../services/template.service";

@Controller("templates")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplateService) {}

  @Get()
  @RequireWhatsappPermission("whatsapp.template.read")
  list(@Req() request: TenantRequest, @Query() query: ListQueryDto) {
    return this.templates.list(
      request.organizationId,
      query.limit,
      query.cursor,
    );
  }

  @Post()
  @RequireWhatsappPermission("whatsapp.template.manage")
  create(@Req() request: TenantRequest, @Body() body: SaveTemplateDto) {
    return this.templates.create(request.organizationId, request.user.id, body);
  }

  @Get(":id")
  @RequireWhatsappPermission("whatsapp.template.read")
  get(@Req() request: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.templates.get(request.organizationId, id);
  }

  @Patch(":id")
  @RequireWhatsappPermission("whatsapp.template.manage")
  update(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: SaveTemplateDto,
  ) {
    return this.templates.update(
      request.organizationId,
      request.user.id,
      id,
      body,
    );
  }

  @Post(":id/submit")
  @RequireWhatsappPermission("whatsapp.template.submit")
  submit(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.templates.submit(request.organizationId, request.user.id, id);
  }

  @Post(":id/duplicate")
  @RequireWhatsappPermission("whatsapp.template.manage")
  duplicate(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: DuplicateTemplateDto,
  ) {
    return this.templates.duplicate(
      request.organizationId,
      request.user.id,
      id,
      body,
    );
  }

  @Post("sync")
  @HttpCode(202)
  @RequireWhatsappPermission("whatsapp.template.manage")
  sync(@Req() request: TenantRequest) {
    return this.templates.sync(request.organizationId);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequireWhatsappPermission("whatsapp.template.manage")
  archive(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.templates.archive(request.organizationId, request.user.id, id);
  }
}
