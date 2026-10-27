import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { TenantContextService } from "../database/tenant-context.service";
import {
  ConversationReplyInput,
  MessageListDto,
  SendTemplateMessageDto,
} from "./dto/message.dto";
import { EncryptedField } from "../security/encryption/field-encryption.service";

@Injectable()
export class MessagingRepository {
  constructor(private readonly tenants: TenantContextService) {}
  create(org: string, dto: SendTemplateMessageDto) {
    return this.tenants.run(org, async (m) => {
      const [context] = await m.query(
        `SELECT coalesce(c.phone_e164,$4) recipient,coalesce(c.id,c_phone.id) resolved_contact_id,t.name,t.language,t.meta_status,p.status sender_status
   FROM whatsapp_core.whatsapp_phone_numbers p JOIN whatsapp_core.message_templates t ON t.organization_id=p.organization_id
   LEFT JOIN whatsapp_core.contacts c ON c.organization_id=p.organization_id AND c.id=$3
   LEFT JOIN whatsapp_core.contacts c_phone ON c_phone.organization_id=p.organization_id AND c_phone.phone_e164=$4 AND c_phone.deleted_at IS NULL
   WHERE p.organization_id=$1 AND p.id=$2 AND t.id=$5`,
        [
          org,
          dto.senderId,
          dto.contactId ?? null,
          dto.recipientPhone ?? null,
          dto.templateId,
        ],
      );
      if (!context)
        throw new NotFoundException("Sender, template, or contact not found");
      if (!context.recipient)
        throw new BadRequestException("A recipient is required");
      if (!context.resolved_contact_id)
        throw new ConflictException(
          "Recipient must be an existing contact with active consent",
        );
      if (context.meta_status !== "APPROVED")
        throw new ConflictException("Template is not approved");
      if (context.language !== dto.language)
        throw new BadRequestException("Template language mismatch");
      if (context.resolved_contact_id) {
        const [consent] = await m.query(
          `SELECT status FROM whatsapp_core.contact_consents WHERE organization_id=$1 AND contact_id=$2 AND purpose='MARKETING' ORDER BY created_at DESC LIMIT 1`,
          [org, context.resolved_contact_id],
        );
        if (consent?.status !== "OPTED_IN")
          throw new ConflictException("Recipient has not opted in");
      }
      const key = dto.idempotencyKey ?? randomUUID();
      const rows = await m.query(
        `INSERT INTO whatsapp_core.messages(organization_id,contact_id,sender_id,template_id,recipient_e164,language,parameters,operation_key,status) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'QUEUED') ON CONFLICT(organization_id,operation_key) DO UPDATE SET operation_key=excluded.operation_key RETURNING id,status,created_at`,
        [
          org,
          context.resolved_contact_id ?? null,
          dto.senderId,
          dto.templateId,
          context.recipient,
          dto.language,
          JSON.stringify(dto.parameters),
          key,
        ],
      );
      await m.query(
        `INSERT INTO whatsapp_core.outbox_events(organization_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'MESSAGE',$2,'message.queued',jsonb_build_object('messageId',$2)) ON CONFLICT DO NOTHING`,
        [org, rows[0].id],
      );
      return rows[0];
    });
  }
  createConversationReply(
    org: string,
    id: string,
    dto: ConversationReplyInput,
    encrypted?: EncryptedField,
  ) {
    return this.tenants.run(org, async (m) => {
      const [context] = await m.query(
        `SELECT c.id,c.status,ct.status contact_status,t.meta_status,t.language template_language,t.category template_category FROM whatsapp_core.conversations c JOIN whatsapp_core.contacts ct ON ct.id=c.contact_id AND ct.organization_id=c.organization_id LEFT JOIN whatsapp_core.message_templates t ON t.id=$5 AND t.organization_id=c.organization_id WHERE c.organization_id=$1 AND c.id=$2 AND c.sender_id=$3 AND c.contact_id=$4`,
        [
          org,
          dto.conversationId,
          dto.senderId,
          dto.contactId,
          dto.templateId ?? null,
        ],
      );
      if (!context)
        throw new NotFoundException(
          "Conversation, sender, contact, or template not found",
        );
      if (context.status === "CLOSED")
        throw new ConflictException(
          "Closed conversations cannot receive replies",
        );
      if (context.contact_status !== "ACTIVE")
        throw new ConflictException("Contact is suppressed or unavailable");
      if (dto.type === "TEMPLATE") {
        if (context.meta_status !== "APPROVED")
          throw new ConflictException("Template is not approved");
        if (context.template_language !== dto.language)
          throw new BadRequestException("Template language mismatch");
        if (context.template_category === "MARKETING") {
          const [consent] = await m.query(
            `SELECT status FROM whatsapp_core.contact_consents WHERE organization_id=$1 AND contact_id=$2 AND purpose='MARKETING' ORDER BY created_at DESC LIMIT 1`,
            [org, dto.contactId],
          );
          if (consent?.status !== "OPTED_IN")
            throw new ConflictException(
              "Recipient has not opted in to marketing messages",
            );
        }
      }
      const [message] = await m.query(
        `INSERT INTO whatsapp_core.messages(id,organization_id,conversation_id,contact_id,sender_id,template_id,recipient_e164,language,parameters,operation_key,status,direction,message_type,content_ciphertext,content_nonce,content_auth_tag,content_key_version,media_object_key,media_mime_type,media_file_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'QUEUED','OUTBOUND',$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT(organization_id,operation_key) DO UPDATE SET operation_key=excluded.operation_key RETURNING id,status,created_at`,
        [
          id,
          org,
          dto.conversationId,
          dto.contactId,
          dto.senderId,
          dto.templateId ?? null,
          dto.recipientPhone,
          dto.language ?? "und",
          JSON.stringify(dto.parameters ?? {}),
          `conversation:${dto.conversationId}:${dto.idempotencyKey}`,
          dto.type,
          encrypted?.ciphertext ?? null,
          encrypted?.nonce ?? null,
          encrypted?.authTag ?? null,
          encrypted?.keyVersion ?? null,
          dto.mediaObjectKey ?? null,
          dto.mediaMimeType ?? null,
          dto.mediaFileName ?? null,
        ],
      );
      await m.query(
        `UPDATE whatsapp_core.conversations SET last_message_at=greatest(last_message_at,now()),last_outbound_at=now(),version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, dto.conversationId],
      );
      await m.query(
        `INSERT INTO whatsapp_core.conversation_activity_events(organization_id,conversation_id,actor_user_id,event_type,metadata) VALUES($1,$2,$3,'message.queued',jsonb_build_object('messageId',$4,'type',$5))`,
        [org, dto.conversationId, dto.agentUserId, message.id, dto.type],
      );
      await m.query(
        `INSERT INTO whatsapp_core.inbox_realtime_events(organization_id,event_type,resource_id,payload) VALUES($1,'message.sent',$2,jsonb_build_object('conversationId',$2,'messageId',$3,'status','QUEUED'))`,
        [org, dto.conversationId, message.id],
      );
      await m.query(
        `INSERT INTO whatsapp_core.outbox_events(organization_id,aggregate_type,aggregate_id,event_type,payload) VALUES($1,'MESSAGE',$2,'message.queued',jsonb_build_object('messageId',$2)) ON CONFLICT DO NOTHING`,
        [org, message.id],
      );
      return message;
    });
  }
  list(org: string, dto: MessageListDto) {
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT msg.id,msg.campaign_id,msg.sender_id,msg.template_id,msg.status,msg.raw_provider_status,
          regexp_replace(msg.recipient_e164,'^(\\+[0-9]{2})[0-9]+([0-9]{4})$','\\1****\\2') recipient,
          msg.created_at,msg.accepted_at,msg.sent_at,msg.delivered_at,msg.read_at,msg.failed_at,msg.error_code,msg.error_description,
          count(*) OVER()::integer total
         FROM whatsapp_core.messages msg
         WHERE msg.organization_id=$1 AND ($2::varchar IS NULL OR msg.status=$2)
           AND ($3::uuid IS NULL OR msg.campaign_id=$3)
         ORDER BY msg.created_at DESC,msg.id DESC LIMIT $4 OFFSET $5`,
        [
          org,
          dto.status ?? null,
          dto.campaignId ?? null,
          dto.limit,
          (dto.page - 1) * dto.limit,
        ],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: rows[0]?.total ?? 0,
        page: dto.page,
        limit: dto.limit,
      };
    });
  }
  get(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT msg.id,msg.campaign_id,msg.sender_id,msg.template_id,msg.status,msg.raw_provider_status,
              regexp_replace(msg.recipient_e164,'^(\\+[0-9]{2})[0-9]+([0-9]{4})$','\\1****\\2') recipient,
              msg.created_at,msg.accepted_at,msg.sent_at,msg.delivered_at,msg.read_at,msg.failed_at,msg.error_code,msg.error_description,
              coalesce(jsonb_agg(jsonb_build_object('status',e.status,'rawStatus',e.raw_status,'providerTimestamp',e.provider_timestamp,'receivedAt',e.received_at,'errorCode',e.error_code,'errorDescription',e.error_description) ORDER BY e.received_at) FILTER (WHERE e.id IS NOT NULL),'[]') status_history
             FROM whatsapp_core.messages msg LEFT JOIN whatsapp_core.message_status_events e ON e.message_id=msg.id
             WHERE msg.organization_id=$1 AND msg.id=$2 GROUP BY msg.id`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  context(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT msg.*,t.name template_name,p.provider_phone_number_id,mc.credential_ciphertext,mc.credential_nonce,mc.credential_auth_tag,mc.key_version FROM whatsapp_core.messages msg LEFT JOIN whatsapp_core.message_templates t ON t.id=msg.template_id JOIN whatsapp_core.whatsapp_phone_numbers p ON p.id=msg.sender_id JOIN whatsapp_core.whatsapp_accounts a ON a.id=p.account_id JOIN whatsapp_core.meta_connections mc ON mc.id=a.connection_id WHERE msg.organization_id=$1 AND msg.id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  claim(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.messages msg SET status='SUBMITTING',attempt_count=attempt_count+1,updated_at=now()
             WHERE msg.organization_id=$1 AND msg.id=$2 AND msg.status='QUEUED'
               AND (msg.campaign_id IS NULL OR EXISTS(SELECT 1 FROM whatsapp_core.campaigns c WHERE c.id=msg.campaign_id AND c.organization_id=msg.organization_id AND c.status='RUNNING'))
             RETURNING id`,
            [org, id],
          )
        ).length === 1,
    );
  }
  accepted(org: string, id: string, providerId: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.messages SET status='ACCEPTED',provider_message_id=$3,accepted_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, id, providerId],
      ),
    );
  }
  unknown(org: string, id: string, description: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.messages SET status='UNKNOWN_SUBMISSION',error_description=$3,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, id, description.slice(0, 500)],
      ),
    );
  }
  failed(org: string, id: string, description: string) {
    return this.tenants.run(org, async (m) => {
      const [message] = await m.query(
        `UPDATE whatsapp_core.messages SET status='FAILED',failed_at=now(),error_description=$3,updated_at=now()
         WHERE organization_id=$1 AND id=$2 RETURNING campaign_id`,
        [org, id, description.slice(0, 500)],
      );
      if (message?.campaign_id)
        await m.query(
          `UPDATE whatsapp_core.campaigns c SET status='COMPLETED',version=version+1,updated_at=now()
           WHERE c.organization_id=$1 AND c.id=$2 AND c.status='RUNNING'
             AND NOT EXISTS(SELECT 1 FROM whatsapp_core.messages msg WHERE msg.campaign_id=c.id AND msg.status NOT IN ('DELIVERED','READ','FAILED','CANCELLED'))`,
          [org, message.campaign_id],
        );
    });
  }
  campaignMessages(org: string, campaignId: string) {
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `INSERT INTO whatsapp_core.messages(organization_id,campaign_id,contact_id,sender_id,template_id,recipient_e164,language,parameters,operation_key,status) SELECT c.organization_id,c.id,r.contact_id,c.sender_id,c.template_id,ct.phone_e164,t.language,r.parameters,'campaign:'||c.id||':'||r.contact_id,'QUEUED' FROM whatsapp_core.campaigns c JOIN whatsapp_core.campaign_recipients r ON r.campaign_id=c.id AND r.eligibility='ELIGIBLE' JOIN whatsapp_core.contacts ct ON ct.id=r.contact_id JOIN whatsapp_core.message_templates t ON t.id=c.template_id WHERE c.organization_id=$1 AND c.id=$2 AND c.status='RUNNING' ON CONFLICT(organization_id,operation_key) DO UPDATE SET operation_key=excluded.operation_key RETURNING id`,
        [org, campaignId],
      );
      for (const row of rows)
        await m.query(
          `INSERT INTO whatsapp_core.outbox_events(organization_id,aggregate_type,aggregate_id,event_type,payload)
           VALUES($1,'MESSAGE',$2,'message.queued',jsonb_build_object('messageId',$2)) ON CONFLICT DO NOTHING`,
          [org, row.id],
        );
      return rows.map((r: any) => r.id);
    });
  }
  eligibleRecipients(org: string, campaignId: string) {
    return this.tenants.run(org, async (m) =>
      Number(
        (
          await m.query(
            `SELECT count(*)::integer count FROM whatsapp_core.campaign_recipients
             WHERE organization_id=$1 AND campaign_id=$2 AND eligibility='ELIGIBLE'`,
            [org, campaignId],
          )
        )[0].count,
      ),
    );
  }
  queuedCampaignMessages(org: string, campaignId: string) {
    return this.tenants.run(org, async (m) =>
      (
        await m.query(
          `SELECT id FROM whatsapp_core.messages
           WHERE organization_id=$1 AND campaign_id=$2 AND status='QUEUED' ORDER BY created_at,id`,
          [org, campaignId],
        )
      ).map((row: any) => row.id),
    );
  }

  claimDueSchedules(limit = 100) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `WITH due AS (
           SELECT id FROM whatsapp_core.campaign_schedules
           WHERE status IN ('PENDING','CLAIMED') AND scheduled_at<=now() AND (lease_until IS NULL OR lease_until<now())
           ORDER BY scheduled_at FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE whatsapp_core.campaign_schedules s SET status='CLAIMED',lease_until=now()+interval '2 minutes'
         FROM due WHERE s.id=due.id RETURNING s.id,s.organization_id,s.campaign_id`,
        [limit],
      ),
    );
  }
  releaseSchedule(id: string) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `UPDATE whatsapp_core.campaign_schedules SET status='PENDING',lease_until=NULL WHERE id=$1 AND status='CLAIMED'`,
        [id],
      ),
    );
  }

  claimCampaign(org: string, campaignId: string) {
    return this.tenants.run(org, async (m) => {
      const claimed =
        (
          await m.query(
            `UPDATE whatsapp_core.campaigns SET status='RUNNING',version=version+1,updated_at=now()
             WHERE organization_id=$1 AND id=$2 AND status IN ('QUEUED','SCHEDULED')
               AND (scheduled_at IS NULL OR scheduled_at<=now()) RETURNING id`,
            [org, campaignId],
          )
        ).length === 1;
      if (claimed)
        await m.query(
          `UPDATE whatsapp_core.campaign_schedules SET status='DISPATCHED',lease_until=NULL
           WHERE organization_id=$1 AND campaign_id=$2 AND status IN ('PENDING','CLAIMED')`,
          [org, campaignId],
        );
      return claimed;
    });
  }

  claimOutbox(limit = 100) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `WITH due AS (
           SELECT id FROM whatsapp_core.outbox_events
           WHERE status IN ('PENDING','FAILED') AND available_at<=now() AND attempts<20
           ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
         )
         UPDATE whatsapp_core.outbox_events o SET status='PROCESSING',attempts=attempts+1
         FROM due WHERE o.id=due.id
         RETURNING o.id,o.organization_id,o.aggregate_id,o.event_type`,
        [limit],
      ),
    );
  }
  finishOutbox(id: string, succeeded: boolean) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `UPDATE whatsapp_core.outbox_events
         SET status=CASE WHEN $2 THEN 'PROCESSED' WHEN attempts>=20 THEN 'DEAD' ELSE 'FAILED' END,
             processed_at=CASE WHEN $2 THEN now() ELSE NULL END,
             available_at=CASE WHEN $2 THEN available_at ELSE now()+least(interval '1 minute'*power(2,attempts),interval '1 hour') END
         WHERE id=$1`,
        [id, succeeded],
      ),
    );
  }
  failCampaign(org: string, id: string) {
    return this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.campaigns SET status='FAILED',version=version+1,updated_at=now()
             WHERE organization_id=$1 AND id=$2 AND status IN ('QUEUED','RUNNING') RETURNING id`,
            [org, id],
          )
        ).length > 0,
    );
  }
}
