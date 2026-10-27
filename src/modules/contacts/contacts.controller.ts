import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { ContactsService } from "./contacts.service";
import { ContactImportService } from "./contact-import.service";
import {
  ConsentDto,
  ContactListDto,
  CreateContactDto,
  CreateSegmentDto,
  CreateTagDto,
  UpdateContactDto,
} from "./dto/contact.dto";

@Controller("contacts")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly imports: ContactImportService,
  ) {}
  @Post() @RequireWhatsappPermission("contacts.manage") create(
    @Req() r: TenantRequest,
    @Body() dto: CreateContactDto,
  ) {
    return this.contacts.create(r.organizationId, r.user.id, dto);
  }
  @Get() @RequireWhatsappPermission("contacts.read") list(
    @Req() r: TenantRequest,
    @Query() dto: ContactListDto,
  ) {
    return this.contacts.list(r.organizationId, dto);
  }
  @Get("tags") @RequireWhatsappPermission("contacts.read") tags(
    @Req() r: TenantRequest,
  ) {
    return this.contacts.tags(r.organizationId);
  }
  @Post("import")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireWhatsappPermission("contacts.manage")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  importContacts(
    @Req() request: TenantRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.create(request.organizationId, request.user.id, file);
  }
  @Get("imports")
  @RequireWhatsappPermission("contacts.read")
  importsList(@Req() request: TenantRequest) {
    return this.imports.imports(request.organizationId);
  }
  @Get("imports/sample")
  @RequireWhatsappPermission("contacts.read")
  importSample() {
    return new StreamableFile(this.imports.sample(), {
      type: "text/csv",
      disposition: 'attachment; filename="contact-import-template.csv"',
    });
  }
  @Get("imports/:id")
  @RequireWhatsappPermission("contacts.read")
  importStatus(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.imports.get(request.organizationId, id);
  }
  @Get("imports/:id/errors")
  @RequireWhatsappPermission("contacts.read")
  async importErrors(
    @Req() request: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const stream = await this.imports.errorFile(request.organizationId, id);
    response.setHeader("Content-Type", "text/csv");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="contact-import-${id}-errors.csv"`,
    );
    stream.pipe(response);
  }
  @Post("tags") @RequireWhatsappPermission("contacts.manage") createTag(
    @Req() r: TenantRequest,
    @Body() dto: CreateTagDto,
  ) {
    return this.contacts.createTag(r.organizationId, dto);
  }
  @Get("segments") @RequireWhatsappPermission("contacts.read") segments(
    @Req() r: TenantRequest,
  ) {
    return this.contacts.segments(r.organizationId);
  }
  @Post("segments") @RequireWhatsappPermission("contacts.manage") createSegment(
    @Req() r: TenantRequest,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.contacts.createSegment(r.organizationId, r.user.id, dto);
  }
  @Get("segments/:id") @RequireWhatsappPermission("contacts.read") segment(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.contacts.segment(r.organizationId, id);
  }
  @Post("consents") @RequireWhatsappPermission("contacts.manage") consent(
    @Req() r: TenantRequest,
    @Body() dto: ConsentDto,
  ) {
    return this.contacts.consent(r.organizationId, dto);
  }
  @Get(":id") @RequireWhatsappPermission("contacts.read") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.contacts.get(r.organizationId, id);
  }
  @Patch(":id") @RequireWhatsappPermission("contacts.manage") update(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contacts.update(r.organizationId, id, dto);
  }
  @Delete(":id")
  @HttpCode(204)
  @RequireWhatsappPermission("contacts.manage")
  remove(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.contacts.remove(r.organizationId, id);
  }
}
