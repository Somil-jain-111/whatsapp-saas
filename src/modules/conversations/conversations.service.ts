import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";
import { RedisService } from "../../default/databases/redis/redis.service";
import { AuditRepository } from "../audit/audit.repository";
import { MessagingService } from "../messaging/messaging.service";
import { validateInteractiveMessage } from "../messaging/interactive-message";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { PrivateObjectStorageService } from "../storage/private-object-storage.service";
import { MetaGraphProvider } from "../whatsapp-integration/providers/meta-graph.provider";
import { ConversationsRepository } from "./conversations.repository";
import {
  ConversationListDto,
  InboxSettingsDto,
  SavedReplyDto,
  SendConversationMessageDto,
} from "./dto/conversation.dto";

export interface InboundWhatsappMessage {
  providerPhoneId: string;
  providerMessageId: string;
  from: string;
  timestamp: Date;
  type: string;
  text?: string;
  mediaId?: string;
  mime?: string;
  fileName?: string;
  replyTo?: string;
  profileName?: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly repo: ConversationsRepository,
    private readonly encryption: FieldEncryptionService,
    private readonly messaging: MessagingService,
    private readonly storage: PrivateObjectStorageService,
    private readonly redis: RedisService,
    private readonly audit: AuditRepository,
    private readonly meta: MetaGraphProvider,
    private readonly events: EventEmitter2,
  ) {}

  list(org: string, dto: ConversationListDto) {
    return this.repo.list(org, dto);
  }
  async get(org: string, id: string) {
    const value = await this.repo.get(org, id);
    if (!value) throw new NotFoundException("Conversation not found");
    return value;
  }
  async update(
    org: string,
    id: string,
    user: string,
    version: number,
    changes: { status?: string; priority?: string },
  ) {
    const result = await this.repo.update(org, id, user, version, changes);
    if (changes.status && ["OPEN", "RESOLVED"].includes(changes.status))
      this.events.emit("automation.trigger", {
        organizationId: org,
        externalId: `conversation:${id}:${result.version}:${changes.status}`,
        type:
          changes.status === "OPEN"
            ? "CONVERSATION_OPENED"
            : "CONVERSATION_RESOLVED",
        sourceType: "CONVERSATION",
        sourceId: id,
        occurredAt: new Date(),
        payload: {
          conversationId: id,
          status: changes.status,
          contactId: result.contact_id,
          senderId: result.sender_id,
        },
      });
    return result;
  }
  assign(
    org: string,
    id: string,
    user: string,
    to: string | null,
    version: number,
    reason?: string,
  ) {
    return this.repo.assign(org, id, user, to, version, reason);
  }
  activity(org: string, id: string) {
    return this.repo.activityList(org, id);
  }
  async markRead(org: string, id: string, user: string) {
    await this.get(org, id);
    return this.repo.markRead(org, id, user);
  }

  async messages(org: string, id: string) {
    await this.get(org, id);
    const rows = await this.repo.messages(org, id);
    return Promise.all(
      rows.reverse().map(async (row: any) => ({
        ...this.safeMessage(row),
        content: await this.decrypt(
          row,
          `conversation-message:${org}:${row.id}`,
        ),
      })),
    );
  }
  async reply(
    org: string,
    id: string,
    user: string,
    dto: SendConversationMessageDto,
  ) {
    const conversation = await this.get(org, id);
    if (conversation.assigned_user_id && conversation.assigned_user_id !== user)
      throw new ConflictException("Conversation is assigned to another agent");
    return this.queueReply(org, id, user, dto, conversation);
  }
  async automationReply(
    org: string,
    id: string,
    user: string,
    dto: SendConversationMessageDto,
  ) {
    return this.queueReply(org, id, user, dto, await this.get(org, id));
  }
  private async queueReply(
    org: string,
    id: string,
    user: string,
    dto: SendConversationMessageDto,
    conversation: any,
  ) {
    const inside =
      conversation.service_window_expires_at &&
      new Date(conversation.service_window_expires_at) > new Date();
    if (!inside && dto.type !== "TEMPLATE")
      throw new ConflictException(
        "An approved template is required outside the 24-hour customer-service window",
      );
    if (dto.type === "TEXT" && !dto.text?.trim())
      throw new ConflictException("Text is required");
    if (dto.type === "TEMPLATE" && (!dto.templateId || !dto.language))
      throw new ConflictException("Template and language are required");
    if (dto.type === "INTERACTIVE")
      dto.interactive = validateInteractiveMessage(dto.interactive);
    if (["IMAGE", "DOCUMENT", "VIDEO"].includes(dto.type)) {
      if (!dto.mediaObjectKey)
        throw new ConflictException("A validated media upload is required");
      if (!dto.mediaObjectKey.startsWith(`inbox/${org}/${id}/`))
        throw new ConflictException(
          "Media does not belong to this conversation",
        );
    }
    const result = await this.messaging.sendConversationReply(org, {
      conversationId: id,
      contactId: conversation.contact_id,
      recipientPhone: conversation.phone_e164,
      senderId: conversation.sender_id,
      agentUserId: user,
      ...dto,
    });
    await this.audit.append(org, {
      actorUserId: user,
      action: "inbox.message.queued",
      resourceType: "conversation",
      resourceId: id,
      metadata: { messageId: result.id, type: dto.type },
    });
    return result;
  }

  async upload(org: string, conversationId: string, file: Express.Multer.File) {
    await this.get(org, conversationId);
    if (!file || file.size === 0)
      throw new UnsupportedMediaTypeException("A file is required");
    if (file.size > 16 * 1024 * 1024)
      throw new UnsupportedMediaTypeException(
        "Media exceeds the 16 MB inbox limit",
      );
    const mime = this.detect(file.buffer);
    if (!mime || mime !== file.mimetype)
      throw new UnsupportedMediaTypeException(
        "File content does not match an allowed media type",
      );
    const key = `inbox/${org}/${conversationId}/${randomUUID()}`;
    await this.storage.putBuffer(key, file.buffer, mime);
    return {
      objectKey: key,
      mimeType: mime,
      fileName: file.originalname.slice(0, 255),
      size: file.size,
    };
  }
  async media(org: string, conversationId: string, messageId: string) {
    await this.get(org, conversationId);
    const context = await this.repo.mediaContext(
      org,
      conversationId,
      messageId,
    );
    if (!context) throw new NotFoundException("Conversation media not found");
    let key = context.media_object_key;
    if (!key) {
      if (!context.provider_media_id)
        throw new NotFoundException("Conversation media is unavailable");
      const token = (
        await this.encryption.decrypt(
          {
            ciphertext: context.credential_ciphertext,
            nonce: context.credential_nonce,
            authTag: context.credential_auth_tag,
            keyVersion: context.key_version,
          },
          `meta:${org}`,
        )
      ).toString("utf8");
      const downloaded = await this.meta.downloadMedia(
        token,
        context.provider_media_id,
      );
      const detected = this.detect(downloaded.bytes);
      if (downloaded.bytes.length > 16 * 1024 * 1024 || !detected)
        throw new UnsupportedMediaTypeException(
          "Inbound media type is not supported",
        );
      key = `inbox/${org}/${conversationId}/inbound-${messageId}`;
      await this.storage.putBuffer(key, downloaded.bytes, detected);
      await this.repo.saveInboundMedia(
        org,
        conversationId,
        messageId,
        key,
        detected,
      );
      context.media_mime_type = detected;
    }
    return {
      bytes: await this.storage.readBuffer(key),
      mimeType: context.media_mime_type ?? "application/octet-stream",
      fileName: context.media_file_name ?? "attachment",
    };
  }

  async notes(org: string, id: string) {
    await this.get(org, id);
    const rows = await this.repo.noteRows(org, id);
    return Promise.all(
      rows.map(async (row: any) => ({
        id: row.id,
        author_user_id: row.author_user_id,
        author_name: row.author_name,
        version: row.version,
        created_at: row.created_at,
        edited_at: row.edited_at,
        body: await this.decryptNote(row, `conversation-note:${org}:${row.id}`),
      })),
    );
  }
  async addNote(org: string, id: string, user: string, body: string) {
    const noteId = randomUUID();
    const field = await this.encryption.encrypt(
      Buffer.from(body),
      `conversation-note:${org}:${noteId}`,
    );
    const result = await this.repo.addNoteWithId(org, id, user, noteId, field);
    await this.audit.append(org, {
      actorUserId: user,
      action: "inbox.note.created",
      resourceType: "conversation_note",
      resourceId: noteId,
    });
    return result;
  }
  async updateNote(
    org: string,
    id: string,
    noteId: string,
    user: string,
    version: number,
    body: string,
  ) {
    const field = await this.encryption.encrypt(
      Buffer.from(body),
      `conversation-note:${org}:${noteId}`,
    );
    return this.repo.updateNote(org, id, noteId, user, version, field);
  }

  labels(org: string) {
    return this.repo.labels(org);
  }
  createLabel(org: string, user: string, name: string, color: string) {
    return this.repo.createLabel(org, user, name, color);
  }
  updateLabel(org: string, id: string, name?: string, color?: string) {
    return this.repo.updateLabel(org, id, name, color);
  }
  deleteLabel(org: string, id: string) {
    return this.repo.deleteLabel(org, id);
  }
  setLabels(org: string, id: string, user: string, ids: string[]) {
    return this.repo.setLabels(org, id, user, ids);
  }

  async savedReplies(org: string) {
    const rows = await this.repo.savedReplies(org);
    return Promise.all(
      rows.map(async (row: any) => ({
        id: row.id,
        name: row.name,
        shortcut: row.shortcut,
        language: row.language,
        created_at: row.created_at,
        updated_at: row.updated_at,
        content: await this.decryptSaved(row, `saved-reply:${org}:${row.id}`),
      })),
    );
  }
  async createSavedReply(org: string, user: string, dto: SavedReplyDto) {
    const id = randomUUID();
    const field = await this.encryption.encrypt(
      Buffer.from(dto.content),
      `saved-reply:${org}:${id}`,
    );
    return this.repo.createSavedReplyWithId(org, user, id, {
      name: dto.name,
      shortcut: dto.shortcut,
      language: dto.language,
      field,
    });
  }
  async updateSavedReply(
    org: string,
    id: string,
    user: string,
    dto: SavedReplyDto,
  ) {
    const field = await this.encryption.encrypt(
      Buffer.from(dto.content),
      `saved-reply:${org}:${id}`,
    );
    const result = await this.repo.updateSavedReply(org, id, user, {
      name: dto.name,
      shortcut: dto.shortcut,
      language: dto.language,
      field,
    });
    if (!result) throw new NotFoundException("Saved reply not found");
    return result;
  }
  deleteSavedReply(org: string, id: string) {
    return this.repo.deleteSavedReply(org, id);
  }

  async agents(org: string) {
    const rows = await this.repo.agents(org);
    return Promise.all(
      rows.map(async (row: any) => ({
        ...row,
        presence:
          (await this.redis.get<string>(`inbox:presence:${org}:${row.id}`)) ??
          "OFFLINE",
      })),
    );
  }
  async availability(org: string, user: string, status: string) {
    await this.repo.setAvailability(org, user, status);
    if (status === "OFFLINE")
      await this.redis.delete(`inbox:presence:${org}:${user}`);
    else await this.redis.set(`inbox:presence:${org}:${user}`, status, 75);
    return { status };
  }
  heartbeat(org: string, user: string, status: string) {
    return this.redis.set(`inbox:presence:${org}:${user}`, status, 75);
  }
  realtime(org: string, user: string, cursor: number) {
    return this.repo.realtime(org, user, cursor);
  }
  analytics(org: string) {
    return this.repo.analytics(org);
  }
  settings(org: string) {
    return this.repo.settings(org);
  }
  updateSettings(org: string, user: string, dto: InboxSettingsDto) {
    return this.repo.updateSettings(org, user, dto);
  }

  @OnEvent("inbox.inbound", { async: true })
  async inbound(input: InboundWhatsappMessage) {
    const supported = [
      "TEXT",
      "TEMPLATE",
      "INTERACTIVE",
      "IMAGE",
      "DOCUMENT",
      "VIDEO",
      "AUDIO",
      "STICKER",
      "LOCATION",
      "CONTACTS",
    ];
    const type = supported.includes(input.type.toUpperCase())
      ? input.type.toUpperCase()
      : "UNSUPPORTED";
    const encrypted = input.text
      ? await this.encryption.encrypt(
          Buffer.from(input.text),
          `inbound:${input.providerMessageId}`,
        )
      : undefined;
    const result = await this.repo.inbound({
      ...input,
      type,
      timestamp: new Date(input.timestamp),
      encrypted,
    });
    if (result) {
      this.events.emit("automation.trigger", {
        organizationId: result.organizationId,
        externalId: input.providerMessageId,
        type: "INCOMING_MESSAGE",
        sourceType: "MESSAGE",
        sourceId: result.messageId,
        occurredAt: new Date(input.timestamp),
        payload: {
          text: input.text,
          type,
          conversationId: result.conversationId,
          contactId: result.contactId,
          senderId: result.senderId,
          messageId: result.messageId,
        },
      });
      if (result.created)
        this.events.emit("automation.trigger", {
          organizationId: result.organizationId,
          externalId: `conversation-opened:${result.conversationId}`,
          type: "CONVERSATION_OPENED",
          sourceType: "CONVERSATION",
          sourceId: result.conversationId,
          occurredAt: new Date(input.timestamp),
          payload: {
            conversationId: result.conversationId,
            contactId: result.contactId,
            senderId: result.senderId,
          },
        });
    }
    return result;
  }
  @OnEvent("inbox.outbound.status", { async: true })
  async outboundStatus(input: {
    organizationId: string;
    conversationId: string;
    messageId: string;
    status: string;
  }) {
    await this.repo.recordOutboundStatus(
      input.organizationId,
      input.conversationId,
      input.messageId,
      input.status,
    );
    if (["DELIVERED", "FAILED"].includes(input.status))
      this.events.emit("automation.trigger", {
        organizationId: input.organizationId,
        externalId: `message.${input.status.toLowerCase()}:${input.messageId}:${input.status}`,
        type: `MESSAGE_${input.status}`,
        sourceType: "MESSAGE",
        sourceId: input.messageId,
        occurredAt: new Date(),
        payload: {
          conversationId: input.conversationId,
          messageId: input.messageId,
          status: input.status,
        },
      });
  }

  private async decrypt(row: any, context: string) {
    if (!row.content_ciphertext) return null;
    return (
      await this.encryption.decrypt(
        {
          ciphertext: row.content_ciphertext,
          nonce: row.content_nonce,
          authTag: row.content_auth_tag,
          keyVersion: row.content_key_version,
        },
        row.direction === "INBOUND"
          ? `inbound:${row.provider_message_id}`
          : context,
      )
    ).toString("utf8");
  }
  private async decryptNote(row: any, context: string) {
    return (
      await this.encryption.decrypt(
        {
          ciphertext: row.body_ciphertext,
          nonce: row.body_nonce,
          authTag: row.body_auth_tag,
          keyVersion: row.key_version,
        },
        context,
      )
    ).toString("utf8");
  }
  private async decryptSaved(row: any, context: string) {
    return (
      await this.encryption.decrypt(
        {
          ciphertext: row.content_ciphertext,
          nonce: row.content_nonce,
          authTag: row.content_auth_tag,
          keyVersion: row.key_version,
        },
        context,
      )
    ).toString("utf8");
  }
  private safeMessage(row: any) {
    const safe = { ...row };
    delete safe.content_ciphertext;
    delete safe.content_nonce;
    delete safe.content_auth_tag;
    delete safe.content_key_version;
    return safe;
  }
  private detect(value: Buffer) {
    if (value.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
      return "image/jpeg";
    if (
      value
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    )
      return "image/png";
    if (value.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
    if (value.length > 12 && value.subarray(4, 8).toString() === "ftyp")
      return "video/mp4";
    return null;
  }
}
