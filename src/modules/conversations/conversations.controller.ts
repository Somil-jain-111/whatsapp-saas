import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { Observable, concatMap, from, map, mergeMap, of, timer } from "rxjs";
import { PhaseOneAuthGuard } from "../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../whatsapp-integration/interfaces/request-context.interface";
import { ConversationsService } from "./conversations.service";
import {
  AssignConversationDto,
  AssignLabelsDto,
  AvailabilityDto,
  ConversationListDto,
  CreateLabelDto,
  CreateNoteDto,
  InboxSettingsDto,
  RealtimeQueryDto,
  SavedReplyDto,
  SendConversationMessageDto,
  UpdateConversationDto,
  UpdateLabelDto,
  UpdateNoteDto,
  VersionDto,
} from "./dto/conversation.dto";

@Controller("conversations")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}
  @Get() @RequireWhatsappPermission("inbox.read") list(
    @Req() r: TenantRequest,
    @Query() q: ConversationListDto,
  ) {
    return this.service.list(r.organizationId, q);
  }
  @Get(":id") @RequireWhatsappPermission("inbox.read") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.organizationId, id);
  }
  @Patch(":id") @RequireWhatsappPermission("inbox.manage") update(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateConversationDto,
  ) {
    return this.service.update(r.organizationId, id, r.user.id, b.version, {
      status: b.status,
      priority: b.priority,
    });
  }
  @Post(":id/assign") @RequireWhatsappPermission("inbox.assign") assign(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: AssignConversationDto,
  ) {
    return this.service.assign(
      r.organizationId,
      id,
      r.user.id,
      b.userId,
      b.version,
      b.reason,
    );
  }
  @Post(":id/unassign") @RequireWhatsappPermission("inbox.assign") unassign(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: VersionDto,
  ) {
    return this.service.assign(
      r.organizationId,
      id,
      r.user.id,
      null,
      b.version,
    );
  }
  @Post(":id/resolve") @RequireWhatsappPermission("inbox.manage") resolve(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: VersionDto,
  ) {
    return this.service.update(r.organizationId, id, r.user.id, b.version, {
      status: "RESOLVED",
    });
  }
  @Post(":id/reopen") @RequireWhatsappPermission("inbox.manage") reopen(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: VersionDto,
  ) {
    return this.service.update(r.organizationId, id, r.user.id, b.version, {
      status: "OPEN",
    });
  }
  @Get(":id/activity") @RequireWhatsappPermission("inbox.read") activity(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.activity(r.organizationId, id);
  }
  @Post(":id/read") @RequireWhatsappPermission("inbox.read") markRead(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(r.organizationId, id, r.user.id);
  }
  @Get(":id/messages") @RequireWhatsappPermission("inbox.read") messages(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.messages(r.organizationId, id);
  }
  @Post(":id/messages") @RequireWhatsappPermission("inbox.reply") reply(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: SendConversationMessageDto,
  ) {
    return this.service.reply(r.organizationId, id, r.user.id, b);
  }
  @Post(":id/media")
  @RequireWhatsappPermission("inbox.reply")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 16 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.upload(r.organizationId, id, file);
  }
  @Get(":id/messages/:messageId/media")
  @RequireWhatsappPermission("inbox.read")
  async media(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("messageId", ParseUUIDPipe) messageId: string,
    @Res() response: Response,
  ) {
    const value = await this.service.media(r.organizationId, id, messageId);
    response.type(value.mimeType);
    response.attachment(value.fileName.replace(/["\\\r\n]/g, "_"));
    response.send(value.bytes);
  }
  @Get(":id/notes") @RequireWhatsappPermission("inbox.read") notes(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.notes(r.organizationId, id);
  }
  @Post(":id/notes") @RequireWhatsappPermission("inbox.notes.write") addNote(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: CreateNoteDto,
  ) {
    return this.service.addNote(r.organizationId, id, r.user.id, b.body);
  }
  @Patch(":id/notes/:noteId")
  @RequireWhatsappPermission("inbox.notes.write")
  updateNote(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("noteId", ParseUUIDPipe) noteId: string,
    @Body() b: UpdateNoteDto,
  ) {
    return this.service.updateNote(
      r.organizationId,
      id,
      noteId,
      r.user.id,
      b.version,
      b.body,
    );
  }
  @Post(":id/labels") @RequireWhatsappPermission("inbox.manage") setLabels(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: AssignLabelsDto,
  ) {
    return this.service.setLabels(r.organizationId, id, r.user.id, b.labelIds);
  }
  @Delete(":id/labels/:labelId")
  @RequireWhatsappPermission("inbox.manage")
  async removeLabel(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("labelId", ParseUUIDPipe) labelId: string,
  ) {
    const c = await this.service.get(r.organizationId, id);
    return this.service.setLabels(
      r.organizationId,
      id,
      r.user.id,
      (c.labels ?? [])
        .map((x: any) => x.id)
        .filter((x: string) => x !== labelId),
    );
  }
}

@Controller("inbox")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
export class InboxController {
  constructor(private readonly service: ConversationsService) {}
  @Get("labels") @RequireWhatsappPermission("inbox.read") labels(
    @Req() r: TenantRequest,
  ) {
    return this.service.labels(r.organizationId);
  }
  @Post("labels") @RequireWhatsappPermission("inbox.manage") createLabel(
    @Req() r: TenantRequest,
    @Body() b: CreateLabelDto,
  ) {
    return this.service.createLabel(
      r.organizationId,
      r.user.id,
      b.name,
      b.color,
    );
  }
  @Patch("labels/:id") @RequireWhatsappPermission("inbox.manage") updateLabel(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: UpdateLabelDto,
  ) {
    return this.service.updateLabel(r.organizationId, id, b.name, b.color);
  }
  @Delete("labels/:id") @RequireWhatsappPermission("inbox.manage") deleteLabel(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteLabel(r.organizationId, id);
  }
  @Get("saved-replies") @RequireWhatsappPermission("inbox.read") replies(
    @Req() r: TenantRequest,
  ) {
    return this.service.savedReplies(r.organizationId);
  }
  @Post("saved-replies") @RequireWhatsappPermission("inbox.manage") createReply(
    @Req() r: TenantRequest,
    @Body() b: SavedReplyDto,
  ) {
    return this.service.createSavedReply(r.organizationId, r.user.id, b);
  }
  @Patch("saved-replies/:id")
  @RequireWhatsappPermission("inbox.manage")
  updateReply(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: SavedReplyDto,
  ) {
    return this.service.updateSavedReply(r.organizationId, id, r.user.id, b);
  }
  @Delete("saved-replies/:id")
  @RequireWhatsappPermission("inbox.manage")
  deleteReply(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.deleteSavedReply(r.organizationId, id);
  }
  @Get("agents") @RequireWhatsappPermission("inbox.read") agents(
    @Req() r: TenantRequest,
  ) {
    return this.service.agents(r.organizationId);
  }
  @Patch("agents/me/availability")
  @RequireWhatsappPermission("inbox.read")
  availability(@Req() r: TenantRequest, @Body() b: AvailabilityDto) {
    return this.service.availability(r.organizationId, r.user.id, b.status);
  }
  @Post("agents/me/heartbeat")
  @RequireWhatsappPermission("inbox.read")
  heartbeat(@Req() r: TenantRequest, @Body() b: AvailabilityDto) {
    return this.service.heartbeat(r.organizationId, r.user.id, b.status);
  }
  @Get("analytics") @RequireWhatsappPermission("inbox.read") analytics(
    @Req() r: TenantRequest,
  ) {
    return this.service.analytics(r.organizationId);
  }
  @Get("settings") @RequireWhatsappPermission("inbox.manage") settings(
    @Req() r: TenantRequest,
  ) {
    return this.service.settings(r.organizationId);
  }
  @Patch("settings") @RequireWhatsappPermission("inbox.manage") updateSettings(
    @Req() r: TenantRequest,
    @Body() b: InboxSettingsDto,
  ) {
    return this.service.updateSettings(r.organizationId, r.user.id, b);
  }
  @Sse("events") @RequireWhatsappPermission("inbox.read") events(
    @Req() r: TenantRequest,
    @Query() q: RealtimeQueryDto,
    @Headers("last-event-id") last?: string,
  ): Observable<MessageEvent> {
    let cursor = Math.max(q.cursor, Number(last) || 0);
    return timer(0, 2000).pipe(
      concatMap(() =>
        from(this.service.realtime(r.organizationId, r.user.id, cursor)),
      ),
      mergeMap((rows: any[]) => (rows.length ? from(rows) : of(null))),
      map((row: any) => {
        if (!row) return { type: "heartbeat", data: { cursor } };
        cursor = Number(row.sequence_id);
        return {
          id: String(row.sequence_id),
          type: row.event_type,
          data: {
            ...row.payload,
            resourceId: row.resource_id,
            createdAt: row.created_at,
          },
        };
      }),
    );
  }
}
