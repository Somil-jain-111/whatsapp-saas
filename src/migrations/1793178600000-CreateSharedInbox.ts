import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSharedInbox1793178600000 implements MigrationInterface {
  name = "CreateSharedInbox1793178600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        sender_id uuid NOT NULL, contact_id uuid NOT NULL, assigned_user_id uuid,
        status varchar(20) NOT NULL DEFAULT 'OPEN', priority varchar(20) NOT NULL DEFAULT 'NORMAL',
        version integer NOT NULL DEFAULT 1, unread_count integer NOT NULL DEFAULT 0,
        last_message_at timestamptz NOT NULL, last_inbound_at timestamptz,
        last_outbound_at timestamptz, service_window_expires_at timestamptz,
        resolved_at timestamptz, closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        retention_until timestamptz NOT NULL DEFAULT now()+interval '3 years',
        CONSTRAINT uq_conversations_id_org UNIQUE(id,organization_id),
        CONSTRAINT fk_conversation_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_conversation_sender FOREIGN KEY(sender_id,organization_id) REFERENCES whatsapp_core.whatsapp_phone_numbers(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_conversation_contact FOREIGN KEY(contact_id,organization_id) REFERENCES whatsapp_core.contacts(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_conversation_assignee FOREIGN KEY(organization_id,assigned_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_conversation_status CHECK(status IN ('OPEN','PENDING','RESOLVED','CLOSED')),
        CONSTRAINT ck_conversation_priority CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT')),
        CONSTRAINT ck_conversation_numbers CHECK(version>0 AND unread_count>=0),
        CONSTRAINT ck_conversation_times CHECK((status='RESOLVED')=(resolved_at IS NOT NULL) AND (status='CLOSED')=(closed_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX uq_active_conversation_party ON whatsapp_core.conversations(organization_id,sender_id,contact_id) WHERE status<>'CLOSED';
      CREATE INDEX idx_conversations_inbox ON whatsapp_core.conversations(organization_id,status,priority,last_message_at DESC,id DESC);
      CREATE INDEX idx_conversations_assignee ON whatsapp_core.conversations(organization_id,assigned_user_id,status,last_message_at DESC);

      ALTER TABLE whatsapp_core.messages ALTER COLUMN template_id DROP NOT NULL;
      ALTER TABLE whatsapp_core.messages
        ADD COLUMN conversation_id uuid,
        ADD COLUMN direction varchar(10) NOT NULL DEFAULT 'OUTBOUND',
        ADD COLUMN message_type varchar(20) NOT NULL DEFAULT 'TEMPLATE',
        ADD COLUMN content_ciphertext bytea,
        ADD COLUMN content_nonce bytea,
        ADD COLUMN content_auth_tag bytea,
        ADD COLUMN content_key_version varchar(50),
        ADD COLUMN media_object_key varchar(1024),
        ADD COLUMN media_mime_type varchar(100),
        ADD COLUMN media_file_name varchar(255),
        ADD COLUMN provider_media_id varchar(255),
        ADD COLUMN reply_to_provider_id varchar(255),
        ADD COLUMN inbound_at timestamptz,
        ADD CONSTRAINT fk_message_conversation FOREIGN KEY(conversation_id,organization_id) REFERENCES whatsapp_core.conversations(id,organization_id) ON DELETE RESTRICT,
        ADD CONSTRAINT ck_message_direction CHECK(direction IN ('INBOUND','OUTBOUND')),
        ADD CONSTRAINT ck_message_type CHECK(message_type IN ('TEXT','TEMPLATE','IMAGE','DOCUMENT','VIDEO','AUDIO','STICKER','LOCATION','CONTACTS','UNSUPPORTED')),
        ADD CONSTRAINT ck_message_content_encryption CHECK(
          (content_ciphertext IS NULL AND content_nonce IS NULL AND content_auth_tag IS NULL AND content_key_version IS NULL) OR
          (content_ciphertext IS NOT NULL AND content_nonce IS NOT NULL AND content_auth_tag IS NOT NULL AND content_key_version IS NOT NULL)
        );
      CREATE INDEX idx_messages_conversation_time ON whatsapp_core.messages(organization_id,conversation_id,created_at,id);
      CREATE INDEX idx_messages_inbound_time ON whatsapp_core.messages(organization_id,conversation_id,inbound_at DESC) WHERE direction='INBOUND';

      CREATE TABLE whatsapp_core.conversation_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, conversation_id uuid NOT NULL,
        from_user_id uuid, to_user_id uuid, assigned_by_user_id uuid NOT NULL, reason varchar(255), created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_assignment_conversation FOREIGN KEY(conversation_id,organization_id) REFERENCES whatsapp_core.conversations(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_assignment_from FOREIGN KEY(organization_id,from_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT fk_assignment_to FOREIGN KEY(organization_id,to_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT fk_assignment_actor FOREIGN KEY(organization_id,assigned_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_assignment_change CHECK(from_user_id IS DISTINCT FROM to_user_id)
      );
      CREATE INDEX idx_assignment_conversation_time ON whatsapp_core.conversation_assignments(organization_id,conversation_id,created_at DESC);

      CREATE TABLE whatsapp_core.conversation_notes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, conversation_id uuid NOT NULL,
        author_user_id uuid NOT NULL, body_ciphertext bytea NOT NULL, body_nonce bytea NOT NULL, body_auth_tag bytea NOT NULL,
        key_version varchar(50) NOT NULL, version integer NOT NULL DEFAULT 1, edited_at timestamptz,
        deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), retention_until timestamptz NOT NULL DEFAULT now()+interval '3 years',
        CONSTRAINT uq_conversation_notes_id_org UNIQUE(id,organization_id),
        CONSTRAINT fk_note_conversation FOREIGN KEY(conversation_id,organization_id) REFERENCES whatsapp_core.conversations(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_note_author FOREIGN KEY(organization_id,author_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_note_version CHECK(version>0)
      );
      CREATE INDEX idx_notes_conversation_time ON whatsapp_core.conversation_notes(organization_id,conversation_id,created_at DESC);
      CREATE TABLE whatsapp_core.conversation_note_revisions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, note_id uuid NOT NULL,
        editor_user_id uuid NOT NULL, version integer NOT NULL, body_ciphertext bytea NOT NULL, body_nonce bytea NOT NULL,
        body_auth_tag bytea NOT NULL, key_version varchar(50) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_note_revision_note FOREIGN KEY(note_id,organization_id) REFERENCES whatsapp_core.conversation_notes(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_note_revision_editor FOREIGN KEY(organization_id,editor_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT uq_note_revision UNIQUE(note_id,version)
      );

      CREATE TABLE whatsapp_core.conversation_labels (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(100) NOT NULL,
        color char(7) NOT NULL DEFAULT '#64748b', created_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_conversation_labels_id_org UNIQUE(id,organization_id),
        CONSTRAINT uq_conversation_label_name UNIQUE(organization_id,name),
        CONSTRAINT fk_conversation_label_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversation_label_creator FOREIGN KEY(organization_id,created_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_conversation_label_name CHECK(length(btrim(name)) BETWEEN 1 AND 100),
        CONSTRAINT ck_conversation_label_color CHECK(color ~ '^#[0-9a-fA-F]{6}$')
      );
      CREATE TABLE whatsapp_core.conversation_label_mappings (
        organization_id uuid NOT NULL, conversation_id uuid NOT NULL, label_id uuid NOT NULL,
        assigned_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(conversation_id,label_id),
        CONSTRAINT fk_mapping_conversation FOREIGN KEY(conversation_id,organization_id) REFERENCES whatsapp_core.conversations(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_mapping_label FOREIGN KEY(label_id,organization_id) REFERENCES whatsapp_core.conversation_labels(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_mapping_actor FOREIGN KEY(organization_id,assigned_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT
      );
      CREATE INDEX idx_conversation_label_filter ON whatsapp_core.conversation_label_mappings(organization_id,label_id,conversation_id);

      CREATE TABLE whatsapp_core.saved_replies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(100) NOT NULL,
        shortcut varchar(50) NOT NULL, content_ciphertext bytea NOT NULL, content_nonce bytea NOT NULL,
        content_auth_tag bytea NOT NULL, key_version varchar(50) NOT NULL, language varchar(20) NOT NULL,
        created_by_user_id uuid NOT NULL, updated_by_user_id uuid NOT NULL, deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_saved_replies_id_org UNIQUE(id,organization_id),
        CONSTRAINT uq_saved_reply_shortcut UNIQUE(organization_id,shortcut),
        CONSTRAINT fk_saved_reply_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_saved_reply_creator FOREIGN KEY(organization_id,created_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT fk_saved_reply_updater FOREIGN KEY(organization_id,updated_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_saved_reply_name CHECK(length(btrim(name)) BETWEEN 1 AND 100),
        CONSTRAINT ck_saved_reply_shortcut CHECK(shortcut ~ '^/[a-z0-9_-]{1,49}$')
      );

      CREATE TABLE whatsapp_core.agent_availability (
        organization_id uuid NOT NULL, user_id uuid NOT NULL, preferred_status varchar(20) NOT NULL DEFAULT 'ONLINE',
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,user_id),
        CONSTRAINT fk_agent_availability_member FOREIGN KEY(organization_id,user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE CASCADE,
        CONSTRAINT ck_agent_availability_status CHECK(preferred_status IN ('ONLINE','AWAY','BUSY','OFFLINE'))
      );

      CREATE TABLE whatsapp_core.conversation_activity_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, conversation_id uuid NOT NULL,
        actor_user_id uuid, event_type varchar(50) NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '3 years',
        CONSTRAINT fk_activity_conversation FOREIGN KEY(conversation_id,organization_id) REFERENCES whatsapp_core.conversations(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_activity_actor FOREIGN KEY(organization_id,actor_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_activity_metadata CHECK(jsonb_typeof(metadata)='object' AND octet_length(metadata::text)<=8192)
      );
      CREATE INDEX idx_conversation_activity_time ON whatsapp_core.conversation_activity_events(organization_id,conversation_id,created_at DESC,id DESC);

      CREATE TABLE whatsapp_core.inbox_realtime_events (
        sequence_id bigserial PRIMARY KEY, organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        event_type varchar(60) NOT NULL, resource_id uuid, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
        CONSTRAINT ck_inbox_realtime_payload CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16384)
      );
      CREATE INDEX idx_inbox_realtime_org_cursor ON whatsapp_core.inbox_realtime_events(organization_id,sequence_id);
      CREATE INDEX idx_inbox_realtime_expiry ON whatsapp_core.inbox_realtime_events(expires_at);

      CREATE TABLE whatsapp_core.inbox_settings (
        organization_id uuid PRIMARY KEY REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        default_sender_id uuid, notifications_enabled boolean NOT NULL DEFAULT true,
        routing_mode varchar(20) NOT NULL DEFAULT 'MANUAL', retention_days integer NOT NULL DEFAULT 1095,
        updated_by_user_id uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_inbox_settings_sender FOREIGN KEY(default_sender_id,organization_id) REFERENCES whatsapp_core.whatsapp_phone_numbers(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_inbox_settings_user FOREIGN KEY(organization_id,updated_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_inbox_routing CHECK(routing_mode='MANUAL'),
        CONSTRAINT ck_inbox_retention CHECK(retention_days BETWEEN 30 AND 2555)
      );

      INSERT INTO whatsapp_core.permissions(code,name) VALUES
        ('inbox.read','Read shared inbox'),('inbox.reply','Reply to inbox conversations'),
        ('inbox.assign','Assign inbox conversations'),('inbox.manage','Manage inbox configuration and labels'),
        ('inbox.notes.write','Write internal conversation notes')
      ON CONFLICT(code) DO UPDATE SET name=excluded.name,status='ACTIVE';
      INSERT INTO whatsapp_core.role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM whatsapp_core.roles r CROSS JOIN whatsapp_core.permissions p
      WHERE r.code IN ('owner','admin','platform.super_admin') AND p.code LIKE 'inbox.%'
      ON CONFLICT DO NOTHING;

      DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY[
        'conversations','conversation_assignments','conversation_notes','conversation_note_revisions',
        'conversation_labels','conversation_label_mappings','saved_replies','agent_availability',
        'conversation_activity_events','inbox_realtime_events','inbox_settings'
      ] LOOP
        EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t);
        EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
        EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false)) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false))','tenant_isolation_'||t,t);
      END LOOP; END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TABLE IF EXISTS whatsapp_core.inbox_settings,whatsapp_core.inbox_realtime_events,whatsapp_core.conversation_activity_events,
        whatsapp_core.agent_availability,whatsapp_core.saved_replies,whatsapp_core.conversation_label_mappings,
        whatsapp_core.conversation_labels,whatsapp_core.conversation_note_revisions,whatsapp_core.conversation_notes,
        whatsapp_core.conversation_assignments CASCADE;
      ALTER TABLE whatsapp_core.messages DROP CONSTRAINT IF EXISTS fk_message_conversation,
        DROP CONSTRAINT IF EXISTS ck_message_direction,DROP CONSTRAINT IF EXISTS ck_message_type,
        DROP CONSTRAINT IF EXISTS ck_message_content_encryption,
        DROP COLUMN IF EXISTS inbound_at,DROP COLUMN IF EXISTS reply_to_provider_id,DROP COLUMN IF EXISTS provider_media_id,
        DROP COLUMN IF EXISTS media_file_name,DROP COLUMN IF EXISTS media_mime_type,DROP COLUMN IF EXISTS media_object_key,
        DROP COLUMN IF EXISTS content_key_version,DROP COLUMN IF EXISTS content_auth_tag,DROP COLUMN IF EXISTS content_nonce,
        DROP COLUMN IF EXISTS content_ciphertext,DROP COLUMN IF EXISTS message_type,DROP COLUMN IF EXISTS direction,
        DROP COLUMN IF EXISTS conversation_id;
      ALTER TABLE whatsapp_core.messages ALTER COLUMN template_id SET NOT NULL;
      DROP TABLE IF EXISTS whatsapp_core.conversations;
    `);
  }
}
