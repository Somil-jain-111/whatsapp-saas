import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import { ConversationListDto, InboxSettingsDto } from "./dto/conversation.dto";
import { EncryptedField } from "../security/encryption/field-encryption.service";

@Injectable()
export class ConversationsRepository {
  constructor(private readonly tenants: TenantContextService) {}

  list(org: string, dto: ConversationListDto) {
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT c.id,c.status,c.priority,c.version,c.unread_count,c.assigned_user_id,c.sender_id,c.contact_id,
          c.last_message_at,c.last_inbound_at,c.last_outbound_at,c.service_window_expires_at,
          ct.full_name,regexp_replace(ct.phone_e164,'^(\\+[0-9]{2})[0-9]+([0-9]{4})$','\\1****\\2') phone,
          u.full_name assigned_agent,p.display_phone_number,
          coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',l.id,'name',l.name,'color',l.color)) FILTER(WHERE l.id IS NOT NULL),'[]') labels,
          count(*) OVER()::integer total
         FROM whatsapp_core.conversations c
         JOIN whatsapp_core.contacts ct ON ct.id=c.contact_id AND ct.organization_id=c.organization_id
         JOIN whatsapp_core.whatsapp_phone_numbers p ON p.id=c.sender_id AND p.organization_id=c.organization_id
         LEFT JOIN whatsapp_core.users u ON u.id=c.assigned_user_id
         LEFT JOIN whatsapp_core.conversation_label_mappings lm ON lm.conversation_id=c.id
         LEFT JOIN whatsapp_core.conversation_labels l ON l.id=lm.label_id
         WHERE c.organization_id=$1 AND ($2::varchar IS NULL OR c.status=$2)
           AND ($3::uuid IS NULL OR c.assigned_user_id=$3) AND ($4::uuid IS NULL OR c.sender_id=$4)
           AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM whatsapp_core.conversation_label_mappings x WHERE x.conversation_id=c.id AND x.label_id=$5))
           AND ($6::varchar IS NULL OR ct.full_name ILIKE '%'||$6||'%' OR ct.phone_e164 LIKE '%'||$6||'%')
         GROUP BY c.id,ct.id,u.id,p.id ORDER BY c.last_message_at DESC,c.id DESC LIMIT $7 OFFSET $8`,
        [
          org,
          dto.status ?? null,
          dto.agentId ?? null,
          dto.senderId ?? null,
          dto.labelId ?? null,
          dto.search ?? null,
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
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `SELECT c.*,ct.full_name,ct.phone_e164,ct.email,ct.custom_attributes,ct.status contact_status,
          u.full_name assigned_agent,p.display_phone_number,
          coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) FROM whatsapp_core.contact_tag_mappings tm JOIN whatsapp_core.contact_tags t ON t.id=tm.tag_id WHERE tm.contact_id=ct.id),'[]') contact_tags,
          (SELECT status FROM whatsapp_core.contact_consents cs WHERE cs.organization_id=$1 AND cs.contact_id=ct.id AND cs.purpose='MARKETING' ORDER BY cs.created_at DESC LIMIT 1) marketing_consent,
          coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'color',l.color)) FROM whatsapp_core.conversation_label_mappings lm JOIN whatsapp_core.conversation_labels l ON l.id=lm.label_id WHERE lm.conversation_id=c.id),'[]') labels
         FROM whatsapp_core.conversations c JOIN whatsapp_core.contacts ct ON ct.id=c.contact_id
         JOIN whatsapp_core.whatsapp_phone_numbers p ON p.id=c.sender_id LEFT JOIN whatsapp_core.users u ON u.id=c.assigned_user_id
         WHERE c.organization_id=$1 AND c.id=$2`,
        [org, id],
      );
      return row ?? null;
    });
  }

  update(
    org: string,
    id: string,
    user: string,
    version: number,
    changes: { status?: string; priority?: string },
  ) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.conversations SET
          status=coalesce($5,status),priority=coalesce($6,priority),
          resolved_at=CASE WHEN $5='RESOLVED' THEN now() ELSE NULL END,
          closed_at=CASE WHEN $5='CLOSED' THEN now() ELSE NULL END,
          version=version+1,updated_at=now()
         WHERE organization_id=$1 AND id=$2 AND version=$3 RETURNING *`,
        [
          org,
          id,
          version,
          user,
          changes.status ?? null,
          changes.priority ?? null,
        ],
      );
      if (!row)
        throw new ConflictException("Conversation changed; refresh and retry");
      await this.activity(m, org, id, user, "conversation.updated", changes);
      await this.emitRealtime(m, org, "conversation.updated", id, {
        status: row.status,
        priority: row.priority,
        version: row.version,
      });
      return row;
    });
  }

  assign(
    org: string,
    id: string,
    actor: string,
    toUser: string | null,
    version: number,
    reason?: string,
  ) {
    return this.tenants.run(org, async (m) => {
      if (toUser) {
        const [member] = await m.query(
          `SELECT 1 FROM whatsapp_core.organization_members WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
          [org, toUser],
        );
        if (!member) throw new NotFoundException("Active agent not found");
      }
      const [row] = await m.query(
        `WITH previous AS (SELECT assigned_user_id FROM whatsapp_core.conversations WHERE organization_id=$1 AND id=$2 AND version=$3 FOR UPDATE),
         changed AS (UPDATE whatsapp_core.conversations c SET assigned_user_id=$4,version=version+1,updated_at=now() FROM previous p WHERE c.organization_id=$1 AND c.id=$2 RETURNING c.id,c.assigned_user_id,c.version)
         SELECT changed.*,previous.assigned_user_id previous_user FROM changed CROSS JOIN previous`,
        [org, id, version, toUser],
      );
      if (!row)
        throw new ConflictException("Assignment changed; refresh and retry");
      await m.query(
        `INSERT INTO whatsapp_core.conversation_assignments(organization_id,conversation_id,from_user_id,to_user_id,assigned_by_user_id,reason) VALUES($1,$2,$3,$4,$5,$6)`,
        [org, id, row.previous_user ?? null, toUser, actor, reason ?? null],
      );
      await this.activity(m, org, id, actor, "conversation.assigned", {
        toUserId: toUser,
      });
      await this.emitRealtime(m, org, "conversation.assigned", id, {
        assignedUserId: toUser,
        version: row.version,
      });
      return row;
    });
  }

  messages(org: string, id: string, limit = 100) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT msg.id,msg.direction,msg.message_type,msg.status,msg.created_at,msg.inbound_at,msg.sent_at,msg.delivered_at,msg.read_at,msg.failed_at,
        msg.content_ciphertext,msg.content_nonce,msg.content_auth_tag,msg.content_key_version,msg.media_object_key,msg.media_mime_type,msg.media_file_name,msg.provider_media_id,msg.provider_message_id,
        t.name template_name FROM whatsapp_core.messages msg LEFT JOIN whatsapp_core.message_templates t ON t.id=msg.template_id
       WHERE msg.organization_id=$1 AND msg.conversation_id=$2 ORDER BY msg.created_at DESC,msg.id DESC LIMIT $3`,
        [org, id, limit],
      ),
    );
  }

  mediaContext(org: string, conversationId: string, messageId: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT msg.id,msg.provider_media_id,msg.media_object_key,msg.media_mime_type,msg.media_file_name,mc.credential_ciphertext,mc.credential_nonce,mc.credential_auth_tag,mc.key_version FROM whatsapp_core.messages msg JOIN whatsapp_core.conversations c ON c.id=msg.conversation_id AND c.organization_id=msg.organization_id JOIN whatsapp_core.whatsapp_phone_numbers p ON p.id=c.sender_id AND p.organization_id=c.organization_id JOIN whatsapp_core.whatsapp_accounts a ON a.id=p.account_id JOIN whatsapp_core.meta_connections mc ON mc.id=a.connection_id WHERE msg.organization_id=$1 AND msg.conversation_id=$2 AND msg.id=$3`,
            [org, conversationId, messageId],
          )
        )[0] ?? null,
    );
  }
  saveInboundMedia(
    org: string,
    conversationId: string,
    messageId: string,
    key: string,
    mime: string,
  ) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.messages SET media_object_key=$4,media_mime_type=$5,updated_at=now() WHERE organization_id=$1 AND conversation_id=$2 AND id=$3 AND direction='INBOUND'`,
        [org, conversationId, messageId, key, mime],
      ),
    );
  }

  noteRows(org: string, conversationId: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT n.*,u.full_name author_name FROM whatsapp_core.conversation_notes n JOIN whatsapp_core.users u ON u.id=n.author_user_id
       WHERE n.organization_id=$1 AND n.conversation_id=$2 AND n.deleted_at IS NULL ORDER BY n.created_at DESC`,
        [org, conversationId],
      ),
    );
  }

  addNoteWithId(
    org: string,
    conversationId: string,
    user: string,
    id: string,
    field: EncryptedField,
  ) {
    return this.tenants.run(org, async (m) => {
      const [note] = await m.query(
        `INSERT INTO whatsapp_core.conversation_notes(id,organization_id,conversation_id,author_user_id,body_ciphertext,body_nonce,body_auth_tag,key_version) SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE EXISTS(SELECT 1 FROM whatsapp_core.conversations WHERE organization_id=$2 AND id=$3) RETURNING id,version,created_at`,
        [
          id,
          org,
          conversationId,
          user,
          field.ciphertext,
          field.nonce,
          field.authTag,
          field.keyVersion,
        ],
      );
      if (!note) throw new NotFoundException("Conversation not found");
      await this.activity(m, org, conversationId, user, "note.created", {
        noteId: id,
      });
      await this.emitRealtime(m, org, "conversation.updated", conversationId, {
        reason: "note.created",
      });
      return note;
    });
  }

  updateNote(
    org: string,
    conversationId: string,
    noteId: string,
    user: string,
    version: number,
    field: EncryptedField,
  ) {
    return this.tenants.run(org, async (m) => {
      const [current] = await m.query(
        `SELECT * FROM whatsapp_core.conversation_notes WHERE organization_id=$1 AND conversation_id=$2 AND id=$3 AND deleted_at IS NULL FOR UPDATE`,
        [org, conversationId, noteId],
      );
      if (!current) throw new NotFoundException("Note not found");
      if (current.version !== version)
        throw new ConflictException("Note changed; refresh and retry");
      await m.query(
        `INSERT INTO whatsapp_core.conversation_note_revisions(organization_id,note_id,editor_user_id,version,body_ciphertext,body_nonce,body_auth_tag,key_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          org,
          noteId,
          user,
          current.version,
          current.body_ciphertext,
          current.body_nonce,
          current.body_auth_tag,
          current.key_version,
        ],
      );
      const [updated] = await m.query(
        `UPDATE whatsapp_core.conversation_notes SET body_ciphertext=$4,body_nonce=$5,body_auth_tag=$6,key_version=$7,version=version+1,edited_at=now() WHERE organization_id=$1 AND conversation_id=$2 AND id=$3 RETURNING id,version,edited_at`,
        [
          org,
          conversationId,
          noteId,
          field.ciphertext,
          field.nonce,
          field.authTag,
          field.keyVersion,
        ],
      );
      await this.activity(m, org, conversationId, user, "note.updated", {
        noteId,
      });
      return updated;
    });
  }

  labels(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,name,color,created_at,updated_at FROM whatsapp_core.conversation_labels WHERE organization_id=$1 ORDER BY name`,
        [org],
      ),
    );
  }
  createLabel(org: string, user: string, name: string, color: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.conversation_labels(organization_id,name,color,created_by_user_id) VALUES($1,$2,$3,$4) RETURNING id,name,color,created_at`,
            [org, name.trim(), color.toLowerCase(), user],
          )
        )[0],
    );
  }
  updateLabel(org: string, id: string, name?: string, color?: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.conversation_labels SET name=coalesce($3,name),color=coalesce($4,color),updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING id,name,color,updated_at`,
            [org, id, name?.trim() ?? null, color?.toLowerCase() ?? null],
          )
        )[0] ?? null,
    );
  }
  deleteLabel(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `DELETE FROM whatsapp_core.conversation_labels WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }
  setLabels(
    org: string,
    conversationId: string,
    user: string,
    labelIds: string[],
  ) {
    return this.tenants.run(org, async (m) => {
      const valid = await m.query(
        `SELECT id FROM whatsapp_core.conversation_labels WHERE organization_id=$1 AND id=ANY($2::uuid[])`,
        [org, labelIds],
      );
      if (valid.length !== new Set(labelIds).size)
        throw new NotFoundException("One or more labels were not found");
      await m.query(
        `DELETE FROM whatsapp_core.conversation_label_mappings WHERE organization_id=$1 AND conversation_id=$2`,
        [org, conversationId],
      );
      for (const labelId of labelIds)
        await m.query(
          `INSERT INTO whatsapp_core.conversation_label_mappings(organization_id,conversation_id,label_id,assigned_by_user_id) VALUES($1,$2,$3,$4)`,
          [org, conversationId, labelId, user],
        );
      await this.activity(m, org, conversationId, user, "labels.updated", {
        labelIds,
      });
      return valid;
    });
  }

  savedReplies(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT * FROM whatsapp_core.saved_replies WHERE organization_id=$1 AND deleted_at IS NULL ORDER BY name`,
        [org],
      ),
    );
  }
  createSavedReplyWithId(
    org: string,
    user: string,
    id: string,
    input: {
      name: string;
      shortcut: string;
      language: string;
      field: EncryptedField;
    },
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.saved_replies(id,organization_id,name,shortcut,content_ciphertext,content_nonce,content_auth_tag,key_version,language,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id,name,shortcut,language,created_at`,
            [
              id,
              org,
              input.name,
              input.shortcut,
              input.field.ciphertext,
              input.field.nonce,
              input.field.authTag,
              input.field.keyVersion,
              input.language,
              user,
            ],
          )
        )[0],
    );
  }
  updateSavedReply(
    org: string,
    id: string,
    user: string,
    input: {
      name: string;
      shortcut: string;
      language: string;
      field: EncryptedField;
    },
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.saved_replies SET name=$3,shortcut=$4,language=$5,content_ciphertext=$6,content_nonce=$7,content_auth_tag=$8,key_version=$9,updated_by_user_id=$10,updated_at=now() WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id,name,shortcut,language,updated_at`,
            [
              org,
              id,
              input.name,
              input.shortcut,
              input.language,
              input.field.ciphertext,
              input.field.nonce,
              input.field.authTag,
              input.field.keyVersion,
              user,
            ],
          )
        )[0] ?? null,
    );
  }
  deleteSavedReply(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.saved_replies SET deleted_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL`,
        [org, id],
      ),
    );
  }

  activityList(org: string, conversationId: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT e.id,e.event_type,e.metadata,e.created_at,u.full_name actor_name FROM whatsapp_core.conversation_activity_events e LEFT JOIN whatsapp_core.users u ON u.id=e.actor_user_id WHERE e.organization_id=$1 AND e.conversation_id=$2 ORDER BY e.created_at DESC,e.id DESC LIMIT 200`,
        [org, conversationId],
      ),
    );
  }
  markRead(org: string, conversationId: string, user: string) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.conversations SET unread_count=0,updated_at=now() WHERE organization_id=$1 AND id=$2 AND unread_count>0 RETURNING id,version`,
        [org, conversationId],
      );
      if (row) {
        await this.activity(
          m,
          org,
          conversationId,
          user,
          "conversation.read",
          {},
        );
        await this.emitRealtime(
          m,
          org,
          "conversation.updated",
          conversationId,
          { unreadCount: 0 },
        );
      }
      return row ?? { id: conversationId };
    });
  }

  agents(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT u.id,u.full_name,a.preferred_status,coalesce(count(c.id) FILTER(WHERE c.status IN ('OPEN','PENDING')),0)::integer workload FROM whatsapp_core.organization_members om JOIN whatsapp_core.users u ON u.id=om.user_id LEFT JOIN whatsapp_core.agent_availability a ON a.organization_id=om.organization_id AND a.user_id=om.user_id LEFT JOIN whatsapp_core.conversations c ON c.organization_id=om.organization_id AND c.assigned_user_id=om.user_id WHERE om.organization_id=$1 AND om.status='ACTIVE' GROUP BY u.id,a.preferred_status ORDER BY u.full_name`,
        [org],
      ),
    );
  }
  setAvailability(org: string, user: string, status: string) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `INSERT INTO whatsapp_core.agent_availability(organization_id,user_id,preferred_status) VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET preferred_status=excluded.preferred_status,updated_at=now() RETURNING *`,
        [org, user, status],
      );
      await this.emitRealtime(m, org, "agent.presence.updated", user, {
        userId: user,
        status,
      });
      return row;
    });
  }

  realtime(org: string, user: string, cursor: number) {
    return this.tenants.run(org, async (m) => {
      const [member] = await m.query(
        `SELECT 1 FROM whatsapp_core.organization_members WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
        [org, user],
      );
      if (!member)
        throw new ForbiddenException("Inbox membership is no longer active");
      return m.query(
        `SELECT sequence_id,event_type,resource_id,payload,created_at FROM whatsapp_core.inbox_realtime_events WHERE organization_id=$1 AND sequence_id>$3 AND expires_at>now() ORDER BY sequence_id LIMIT 100`,
        [org, user, cursor],
      );
    });
  }
  analytics(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT count(*) FILTER(WHERE status='OPEN')::integer open,count(*) FILTER(WHERE status='PENDING')::integer pending,count(*) FILTER(WHERE status='RESOLVED')::integer resolved,count(*) FILTER(WHERE assigned_user_id IS NULL AND status IN ('OPEN','PENDING'))::integer unassigned,coalesce(round(avg(extract(epoch FROM (last_outbound_at-last_inbound_at))) FILTER(WHERE last_outbound_at>=last_inbound_at)),0)::integer avg_first_response_seconds,coalesce(round(avg(extract(epoch FROM (resolved_at-created_at))) FILTER(WHERE resolved_at IS NOT NULL)),0)::integer avg_resolution_seconds FROM whatsapp_core.conversations WHERE organization_id=$1`,
            [org],
          )
        )[0],
    );
  }
  settings(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT * FROM whatsapp_core.inbox_settings WHERE organization_id=$1`,
            [org],
          )
        )[0] ?? {
          notifications_enabled: true,
          routing_mode: "MANUAL",
          retention_days: 1095,
        },
    );
  }
  updateSettings(org: string, user: string, dto: InboxSettingsDto) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.inbox_settings(organization_id,default_sender_id,notifications_enabled,retention_days,updated_by_user_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id) DO UPDATE SET default_sender_id=excluded.default_sender_id,notifications_enabled=excluded.notifications_enabled,retention_days=excluded.retention_days,updated_by_user_id=excluded.updated_by_user_id,updated_at=now() RETURNING *`,
            [
              org,
              dto.defaultSenderId ?? null,
              dto.notificationsEnabled,
              dto.retentionDays,
              user,
            ],
          )
        )[0],
    );
  }

  inbound(input: {
    providerPhoneId: string;
    providerMessageId: string;
    from: string;
    timestamp: Date;
    type: string;
    encrypted?: EncryptedField;
    mediaId?: string;
    mime?: string;
    fileName?: string;
    replyTo?: string;
    profileName?: string;
  }) {
    return this.tenants.runAsPlatformAdmin(async (m) => {
      const [sender] = await m.query(
        `SELECT p.id,p.organization_id,o.country_code FROM whatsapp_core.whatsapp_phone_numbers p JOIN whatsapp_core.organizations o ON o.id=p.organization_id WHERE p.provider_phone_number_id=$1`,
        [input.providerPhoneId],
      );
      if (!sender)
        throw new NotFoundException("Inbound sender is not connected");
      await m.query(
        `SELECT set_config('app.organization_id',$1,true),set_config('app.is_platform_admin','false',true)`,
        [sender.organization_id],
      );
      const phone = input.from.startsWith("+") ? input.from : `+${input.from}`;
      const [contact] = await m.query(
        `INSERT INTO whatsapp_core.contacts(organization_id,full_name,country_code,phone_e164,source,created_by_user_id) SELECT $1,$2,$3,$4,'WHATSAPP_INBOUND',om.user_id FROM whatsapp_core.organization_members om WHERE om.organization_id=$1 AND om.status='ACTIVE' ORDER BY om.joined_at LIMIT 1 ON CONFLICT(organization_id,phone_e164) DO UPDATE SET updated_at=now() RETURNING id`,
        [
          sender.organization_id,
          (input.profileName || phone).slice(0, 150),
          sender.country_code,
          phone,
        ],
      );
      let [conversation] = await m.query(
        `SELECT * FROM whatsapp_core.conversations WHERE organization_id=$1 AND sender_id=$2 AND contact_id=$3 AND status<>'CLOSED' FOR UPDATE`,
        [sender.organization_id, sender.id, contact.id],
      );
      let created = false;
      if (!conversation) {
        [conversation] = await m.query(
          `INSERT INTO whatsapp_core.conversations(organization_id,sender_id,contact_id,last_message_at,last_inbound_at,service_window_expires_at,unread_count) VALUES($1,$2,$3,$4,$4,$4+interval '24 hours',1) RETURNING *`,
          [sender.organization_id, sender.id, contact.id, input.timestamp],
        );
        created = true;
      }
      const [message] = await m.query(
        `INSERT INTO whatsapp_core.messages(organization_id,conversation_id,contact_id,sender_id,recipient_e164,language,parameters,operation_key,provider_message_id,status,direction,message_type,content_ciphertext,content_nonce,content_auth_tag,content_key_version,provider_media_id,media_mime_type,media_file_name,reply_to_provider_id,inbound_at,created_at) VALUES($1,$2,$3,$4,$5,'und','{}'::jsonb,$6,$7,'DELIVERED','INBOUND',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) ON CONFLICT(provider_message_id) DO NOTHING RETURNING id`,
        [
          sender.organization_id,
          conversation.id,
          contact.id,
          sender.id,
          phone,
          `inbound:${input.providerMessageId}`,
          input.providerMessageId,
          input.type,
          input.encrypted?.ciphertext ?? null,
          input.encrypted?.nonce ?? null,
          input.encrypted?.authTag ?? null,
          input.encrypted?.keyVersion ?? null,
          input.mediaId ?? null,
          input.mime ?? null,
          input.fileName ?? null,
          input.replyTo ?? null,
          input.timestamp,
        ],
      );
      if (!message) return null;
      if (!created) {
        const wasResolved = conversation.status === "RESOLVED";
        [conversation] = await m.query(
          `UPDATE whatsapp_core.conversations SET status=CASE WHEN status='RESOLVED' THEN 'OPEN' ELSE status END,resolved_at=NULL,last_message_at=greatest(last_message_at,$3),last_inbound_at=greatest(coalesce(last_inbound_at,$3),$3),service_window_expires_at=greatest(coalesce(service_window_expires_at,$3),$3+interval '24 hours'),unread_count=unread_count+1,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [sender.organization_id, conversation.id, input.timestamp],
        );
        if (wasResolved)
          await this.activity(
            m,
            sender.organization_id,
            conversation.id,
            null,
            "conversation.reopened",
            { source: "INBOUND" },
          );
      }
      await this.activity(
        m,
        sender.organization_id,
        conversation.id,
        null,
        "message.received",
        { messageId: message.id, type: input.type },
      );
      const sequence = await this.emitRealtime(
        m,
        sender.organization_id,
        created ? "conversation.created" : "message.received",
        conversation.id,
        { conversationId: conversation.id, messageId: message.id },
      );
      return {
        organizationId: sender.organization_id,
        conversationId: conversation.id,
        contactId: contact.id,
        senderId: sender.id,
        messageId: message.id,
        sequenceId: sequence,
        created,
      };
    });
  }

  recordOutboundStatus(
    org: string,
    conversationId: string,
    messageId: string,
    status: string,
  ) {
    return this.tenants.run(org, async (m) => {
      await this.emitRealtime(
        m,
        org,
        `message.${status.toLowerCase()}`,
        conversationId,
        { conversationId, messageId, status },
      );
    });
  }

  private async activity(
    m: any,
    org: string,
    conversation: string,
    actor: string | null,
    type: string,
    metadata: unknown,
  ) {
    await m.query(
      `INSERT INTO whatsapp_core.conversation_activity_events(organization_id,conversation_id,actor_user_id,event_type,metadata) VALUES($1,$2,$3,$4,$5::jsonb)`,
      [org, conversation, actor, type, JSON.stringify(metadata)],
    );
  }
  private async emitRealtime(
    m: any,
    org: string,
    type: string,
    resource: string,
    payload: unknown,
  ) {
    const [row] = await m.query(
      `INSERT INTO whatsapp_core.inbox_realtime_events(organization_id,event_type,resource_id,payload) VALUES($1,$2,$3,$4::jsonb) RETURNING sequence_id`,
      [org, type, resource, JSON.stringify(payload)],
    );
    return row.sequence_id;
  }
}
