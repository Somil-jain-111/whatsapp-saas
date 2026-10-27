import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseUUIDPipe,
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
import { MessageListDto, SendTemplateMessageDto } from "./dto/message.dto";
import { MessagingService } from "./messaging.service";
@Controller("messages")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class MessagingController {
  constructor(private readonly service: MessagingService) {}
  @Post("template")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireWhatsappPermission("messages.send")
  send(@Req() r: TenantRequest, @Body() d: SendTemplateMessageDto) {
    return this.service.send(r.organizationId, d);
  }

  @Get()
  @RequireWhatsappPermission("messages.read")
  list(@Req() r: TenantRequest, @Query() query: MessageListDto) {
    return this.service.list(r.organizationId, query);
  }

  @Get(":id")
  @RequireWhatsappPermission("messages.read")
  get(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.get(r.organizationId, id);
  }
}
