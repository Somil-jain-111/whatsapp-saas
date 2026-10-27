import { InjectQueue } from "@nestjs/bullmq";
import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Queue } from "bullmq";
import { EntitlementService } from "../billing/services/entitlement.service";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import {
  MetaGraphProvider,
  MetaProviderError,
} from "../whatsapp-integration/providers/meta-graph.provider";
import {
  ConversationReplyInput,
  MessageListDto,
  SendTemplateMessageDto,
} from "./dto/message.dto";
import { MessagingRepository } from "./messaging.repository";
import { PrivateObjectStorageService } from "../storage/private-object-storage.service";
import { InteractiveMessage } from "./interactive-message";
export const WHATSAPP_SEND_QUEUE = "whatsapp-send";
@Injectable()
export class MessagingService implements OnModuleInit {
  constructor(
    private readonly repo: MessagingRepository,
    @InjectQueue(WHATSAPP_SEND_QUEUE) private readonly queue: Queue,
    private readonly encryption: FieldEncryptionService,
    private readonly meta: MetaGraphProvider,
    private readonly entitlements: EntitlementService,
    private readonly events: EventEmitter2,
    private readonly storage: PrivateObjectStorageService,
  ) {}
  async onModuleInit() {
    await this.queue.add(
      "outbox-scan",
      {},
      {
        jobId: "outbox-scan",
        repeat: { every: 30000 },
        removeOnComplete: 10,
      },
    );
  }
  async removeCampaignJob(id: string) {
    const job = await this.queue.getJob(`campaign-${id}`);
    if (job) await job.remove();
  }
  async resumeCampaign(org: string, id: string) {
    await this.removeCampaignJob(id);
    const queued = await this.repo.queuedCampaignMessages(org, id);
    if (queued.length) {
      await this.enqueueMessages(org, queued);
      return;
    }
    await this.enqueueCampaign(org, id);
  }
  async send(org: string, dto: SendTemplateMessageDto) {
    const reservation = await this.entitlements.reserveQuota(
      org,
      "monthly_message_operations",
      1,
      `message:${dto.idempotencyKey ?? randomUUID()}`,
    );
    let message: Awaited<ReturnType<MessagingRepository["create"]>> | undefined;
    try {
      message = await this.repo.create(org, dto);
      await this.entitlements.commitQuota(org, reservation.id);
    } catch (error) {
      await this.entitlements.releaseQuota(org, reservation.id);
      throw error;
    }
    // The transactional outbox created with the message recovers queue outages.
    await this.enqueueMessage(org, message.id).catch(() => undefined);
    return message;
  }
  async sendConversationReply(org: string, dto: ConversationReplyInput) {
    const operation = `conversation:${dto.conversationId}:${dto.idempotencyKey}`;
    const reservation = await this.entitlements.reserveQuota(
      org,
      "monthly_message_operations",
      1,
      operation,
    );
    const id = randomUUID();
    let message:
      | Awaited<ReturnType<MessagingRepository["createConversationReply"]>>
      | undefined;
    try {
      const content =
        dto.type === "INTERACTIVE" ? JSON.stringify(dto.interactive) : dto.text;
      const encrypted = content
        ? await this.encryption.encrypt(
            Buffer.from(content),
            `conversation-message:${org}:${id}`,
          )
        : undefined;
      message = await this.repo.createConversationReply(
        org,
        id,
        dto,
        encrypted,
      );
      await this.entitlements.commitQuota(org, reservation.id);
    } catch (error) {
      await this.entitlements.releaseQuota(org, reservation.id);
      throw error;
    }
    await this.enqueueMessage(org, message.id).catch(() => undefined);
    return message;
  }
  async enqueueCampaign(org: string, id: string, scheduledAt?: Date) {
    await this.queue.add(
      "campaign",
      { organizationId: org, campaignId: id },
      {
        jobId: `campaign-${id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        delay: scheduledAt
          ? Math.max(scheduledAt.getTime() - Date.now(), 0)
          : 0,
        removeOnComplete: true,
      },
    );
  }
  async dispatchCampaign(org: string, id: string) {
    const count = await this.repo.eligibleRecipients(org, id);
    if (!count) return 0;
    const reservation = await this.entitlements.reserveQuota(
      org,
      "monthly_message_operations",
      count,
      `campaign-messages:${id}`,
    );
    let ids: string[] | undefined;
    try {
      if (!(await this.repo.claimCampaign(org, id))) {
        await this.entitlements.releaseQuota(org, reservation.id);
        return 0;
      }
      ids = await this.repo.campaignMessages(org, id);
      this.events.emit("developer.webhook", {
        organizationId: org,
        eventType: "campaign.started",
        payload: { campaign_id: id, status: "RUNNING" },
      });
      await this.entitlements.commitQuota(org, reservation.id);
    } catch (error) {
      await this.entitlements.releaseQuota(org, reservation.id);
      throw error;
    }
    // Every message has an outbox row, so a transient Redis failure is recoverable.
    await this.enqueueMessages(org, ids).catch(() => undefined);
    return ids.length;
  }
  async processOutbox() {
    const schedules = await this.repo.claimDueSchedules();
    for (const schedule of schedules) {
      try {
        await this.enqueueCampaign(
          schedule.organization_id,
          schedule.campaign_id,
        );
      } catch {
        await this.repo.releaseSchedule(schedule.id);
      }
    }
    const events = await this.repo.claimOutbox();
    for (const event of events) {
      try {
        if (event.event_type === "message.queued")
          await this.enqueueMessage(event.organization_id, event.aggregate_id);
        await this.repo.finishOutbox(event.id, true);
      } catch {
        await this.repo.finishOutbox(event.id, false);
      }
    }
    return events.length + schedules.length;
  }
  async deliver(org: string, id: string) {
    if (!(await this.repo.claim(org, id))) return;
    const c = await this.repo.context(org, id);
    if (
      !c?.credential_ciphertext ||
      !c.credential_nonce ||
      !c.credential_auth_tag ||
      !c.key_version
    ) {
      await this.repo.unknown(org, id, "Connection credentials unavailable");
      if (c?.conversation_id)
        this.events.emit("inbox.outbound.status", {
          organizationId: org,
          conversationId: c.conversation_id,
          messageId: id,
          status: "UNKNOWN_SUBMISSION",
        });
      return;
    }
    const token = (
      await this.encryption.decrypt(
        {
          ciphertext: c.credential_ciphertext,
          nonce: c.credential_nonce,
          authTag: c.credential_auth_tag,
          keyVersion: c.key_version,
        },
        `meta:${org}`,
      )
    ).toString("utf8");
    try {
      let result;
      if (c.message_type === "TEMPLATE")
        result = await this.meta.sendTemplate(
          token,
          c.provider_phone_number_id,
          {
            to: c.recipient_e164,
            name: c.template_name,
            language: c.language,
            parameters: c.parameters,
          },
        );
      else if (c.message_type === "TEXT") {
        const text = (
          await this.encryption.decrypt(
            {
              ciphertext: c.content_ciphertext,
              nonce: c.content_nonce,
              authTag: c.content_auth_tag,
              keyVersion: c.content_key_version,
            },
            `conversation-message:${org}:${id}`,
          )
        ).toString("utf8");
        result = await this.meta.sendText(
          token,
          c.provider_phone_number_id,
          c.recipient_e164,
          text,
        );
      } else if (c.message_type === "INTERACTIVE") {
        const interactive = JSON.parse(
          (
            await this.encryption.decrypt(
              {
                ciphertext: c.content_ciphertext,
                nonce: c.content_nonce,
                authTag: c.content_auth_tag,
                keyVersion: c.content_key_version,
              },
              `conversation-message:${org}:${id}`,
            )
          ).toString("utf8"),
        ) as InteractiveMessage;
        result = await this.meta.sendInteractive(
          token,
          c.provider_phone_number_id,
          c.recipient_e164,
          interactive,
        );
      } else {
        const bytes = await this.storage.readBuffer(c.media_object_key);
        const mediaId = await this.meta.uploadMedia(
          token,
          c.provider_phone_number_id,
          bytes,
          c.media_mime_type,
          c.media_file_name ?? "attachment",
        );
        result = await this.meta.sendMedia(
          token,
          c.provider_phone_number_id,
          c.recipient_e164,
          c.message_type.toLowerCase(),
          mediaId,
          c.media_file_name,
        );
      }
      const providerId = result.messages?.[0]?.id;
      if (!providerId)
        throw new BadGatewayException("Meta did not return a message ID");
      await this.repo.accepted(org, id, providerId);
      if (c.conversation_id)
        this.events.emit("inbox.outbound.status", {
          organizationId: org,
          conversationId: c.conversation_id,
          messageId: id,
          status: "ACCEPTED",
        });
      this.events.emit("developer.webhook", {
        organizationId: org,
        eventType: "message.accepted",
        payload: { message_id: id, status: "ACCEPTED" },
      });
    } catch (e) {
      const description =
        e instanceof Error ? e.message : "Ambiguous provider response";
      if (e instanceof MetaProviderError && !e.ambiguous) {
        await this.repo.failed(org, id, description);
        if (c.conversation_id)
          this.events.emit("inbox.outbound.status", {
            organizationId: org,
            conversationId: c.conversation_id,
            messageId: id,
            status: "FAILED",
          });
        this.events.emit("developer.webhook", {
          organizationId: org,
          eventType: "message.failed",
          payload: { message_id: id, status: "FAILED" },
        });
      } else {
        await this.repo.unknown(org, id, description);
        if (c.conversation_id)
          this.events.emit("inbox.outbound.status", {
            organizationId: org,
            conversationId: c.conversation_id,
            messageId: id,
            status: "UNKNOWN_SUBMISSION",
          });
      }
    }
  }
  list(org: string, query: MessageListDto) {
    return this.repo.list(org, query);
  }
  async failCampaign(org: string, id: string) {
    if (await this.repo.failCampaign(org, id))
      this.events.emit("developer.webhook", {
        organizationId: org,
        eventType: "campaign.failed",
        payload: { campaign_id: id, status: "FAILED" },
      });
  }
  async get(org: string, id: string) {
    const value = await this.repo.get(org, id);
    if (!value) throw new NotFoundException("Message not found");
    return value;
  }
  private enqueueMessage(org: string, messageId: string) {
    return this.queue.add(
      "send",
      { organizationId: org, messageId },
      {
        jobId: `message-${messageId}`,
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
  private async enqueueMessages(org: string, messageIds: string[]) {
    for (let index = 0; index < messageIds.length; index += 500)
      await this.queue.addBulk(
        messageIds.slice(index, index + 500).map((messageId) => ({
          name: "send",
          data: { organizationId: org, messageId },
          opts: {
            jobId: `message-${messageId}`,
            attempts: 1,
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        })),
      );
  }
}
