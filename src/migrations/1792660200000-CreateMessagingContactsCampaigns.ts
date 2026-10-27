import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMessagingContactsCampaigns1792660200000 implements MigrationInterface {
  name = "CreateMessagingContactsCampaigns1792660200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        full_name varchar(150) NOT NULL, country_code char(2) NOT NULL, phone_e164 varchar(16) NOT NULL,
        email varchar(254), custom_attributes jsonb NOT NULL DEFAULT '{}'::jsonb, source varchar(30) NOT NULL DEFAULT 'MANUAL',
        status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_by_user_id uuid NOT NULL,
        deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_contacts_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_contacts_country FOREIGN KEY(country_code) REFERENCES whatsapp_core.iso_countries(code) ON DELETE RESTRICT,
        CONSTRAINT fk_contacts_creator FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_contacts_id_org UNIQUE(id,organization_id), CONSTRAINT uq_contacts_org_phone UNIQUE(organization_id,phone_e164),
        CONSTRAINT ck_contacts_name CHECK(length(btrim(full_name)) BETWEEN 1 AND 150),
        CONSTRAINT ck_contacts_phone CHECK(phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'),
        CONSTRAINT ck_contacts_email CHECK(email IS NULL OR (email=lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)),
        CONSTRAINT ck_contacts_values CHECK(status IN ('ACTIVE','SUPPRESSED','DELETED') AND jsonb_typeof(custom_attributes)='object' AND octet_length(custom_attributes::text)<=32768)
      );
      CREATE INDEX idx_contacts_org_created ON whatsapp_core.contacts(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_contacts_org_name ON whatsapp_core.contacts(organization_id,lower(full_name));

      CREATE TABLE whatsapp_core.contact_consents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, contact_id uuid NOT NULL,
        channel varchar(20) NOT NULL DEFAULT 'WHATSAPP', purpose varchar(30) NOT NULL, status varchar(20) NOT NULL,
        source varchar(50) NOT NULL, evidence_reference varchar(500), policy_version varchar(50) NOT NULL,
        consented_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_consents_contact FOREIGN KEY(contact_id,organization_id) REFERENCES whatsapp_core.contacts(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_consents_values CHECK(channel='WHATSAPP' AND purpose IN ('TRANSACTIONAL','MARKETING') AND status IN ('OPTED_IN','OPTED_OUT') AND ((status='OPTED_IN' AND consented_at IS NOT NULL AND revoked_at IS NULL) OR (status='OPTED_OUT' AND revoked_at IS NOT NULL)))
      );
      CREATE INDEX idx_consents_contact_created ON whatsapp_core.contact_consents(organization_id,contact_id,purpose,created_at DESC);

      CREATE TABLE whatsapp_core.contact_tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(100) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT fk_contact_tags_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT uq_contact_tags_id_org UNIQUE(id,organization_id), CONSTRAINT uq_contact_tags_org_name UNIQUE(organization_id,name),
        CONSTRAINT ck_contact_tags_name CHECK(length(btrim(name)) BETWEEN 1 AND 100)
      );
      CREATE TABLE whatsapp_core.contact_tag_mappings (
        organization_id uuid NOT NULL, contact_id uuid NOT NULL, tag_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(contact_id,tag_id), CONSTRAINT fk_contact_tag_contact FOREIGN KEY(contact_id,organization_id) REFERENCES whatsapp_core.contacts(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_contact_tag_tag FOREIGN KEY(tag_id,organization_id) REFERENCES whatsapp_core.contact_tags(id,organization_id) ON DELETE CASCADE
      );
      CREATE TABLE whatsapp_core.contact_segments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(100) NOT NULL,
        definition jsonb NOT NULL, created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_segments_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_segments_creator FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_segments_id_org UNIQUE(id,organization_id), CONSTRAINT uq_segments_org_name UNIQUE(organization_id,name),
        CONSTRAINT ck_segments_definition CHECK(jsonb_typeof(definition)='object' AND octet_length(definition::text)<=16384)
      );

      CREATE TABLE whatsapp_core.contact_imports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, object_key varchar(1024) NOT NULL,
        file_type varchar(10) NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING', total_rows integer NOT NULL DEFAULT 0,
        accepted_rows integer NOT NULL DEFAULT 0, rejected_rows integer NOT NULL DEFAULT 0, error_object_key varchar(1024),
        created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        CONSTRAINT fk_imports_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_imports_user FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_imports_id_org UNIQUE(id,organization_id),
        CONSTRAINT ck_imports_values CHECK(file_type IN ('CSV','XLSX') AND status IN ('PENDING','PROCESSING','COMPLETED','FAILED') AND total_rows>=0 AND accepted_rows>=0 AND rejected_rows>=0)
      );
      CREATE INDEX idx_imports_org_created ON whatsapp_core.contact_imports(organization_id,created_at DESC);
      CREATE TABLE whatsapp_core.contact_import_errors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, import_id uuid NOT NULL,
        row_number integer NOT NULL, code varchar(100) NOT NULL, message varchar(500) NOT NULL, safe_row jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT fk_import_errors_import FOREIGN KEY(import_id,organization_id) REFERENCES whatsapp_core.contact_imports(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_import_error_values CHECK(row_number>0 AND jsonb_typeof(safe_row)='object' AND octet_length(safe_row::text)<=8192)
      );

      ALTER TABLE whatsapp_core.whatsapp_phone_numbers ADD CONSTRAINT uq_whatsapp_phone_numbers_id_org UNIQUE(id,organization_id);

      CREATE TABLE whatsapp_core.campaigns (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(150) NOT NULL,
        description varchar(1000), sender_id uuid NOT NULL, template_id uuid NOT NULL, segment_id uuid,
        scheduled_at timestamptz, timezone varchar(64) NOT NULL DEFAULT 'UTC', status varchar(20) NOT NULL DEFAULT 'DRAFT',
        version integer NOT NULL DEFAULT 1, created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_campaign_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_campaign_sender FOREIGN KEY(sender_id,organization_id) REFERENCES whatsapp_core.whatsapp_phone_numbers(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_campaign_template FOREIGN KEY(template_id,organization_id) REFERENCES whatsapp_core.message_templates(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_campaign_segment FOREIGN KEY(segment_id,organization_id) REFERENCES whatsapp_core.contact_segments(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_campaign_user FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_campaign_id_org UNIQUE(id,organization_id),
        CONSTRAINT ck_campaign_values CHECK(length(btrim(name)) BETWEEN 1 AND 150 AND status IN ('DRAFT','VALIDATING','SCHEDULED','QUEUED','RUNNING','PAUSING','PAUSED','COMPLETED','CANCELLING','CANCELLED','FAILED') AND version>0)
      );
      CREATE INDEX idx_campaign_org_created ON whatsapp_core.campaigns(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_campaign_schedule ON whatsapp_core.campaigns(status,scheduled_at) WHERE status='SCHEDULED';

      CREATE TABLE whatsapp_core.campaign_recipients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, campaign_id uuid NOT NULL, contact_id uuid NOT NULL,
        parameters jsonb NOT NULL DEFAULT '{}'::jsonb, eligibility varchar(20) NOT NULL DEFAULT 'PENDING', reason varchar(500), created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_campaign_recipient_campaign FOREIGN KEY(campaign_id,organization_id) REFERENCES whatsapp_core.campaigns(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_campaign_recipient_contact FOREIGN KEY(contact_id,organization_id) REFERENCES whatsapp_core.contacts(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_campaign_recipient UNIQUE(campaign_id,contact_id),
        CONSTRAINT ck_campaign_recipient_values CHECK(eligibility IN ('PENDING','ELIGIBLE','SUPPRESSED','INVALID') AND jsonb_typeof(parameters)='object' AND octet_length(parameters::text)<=32768)
      );
      CREATE INDEX idx_campaign_recipients_campaign ON whatsapp_core.campaign_recipients(organization_id,campaign_id,eligibility,id);

      CREATE TABLE whatsapp_core.messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, campaign_id uuid, contact_id uuid,
        sender_id uuid NOT NULL, template_id uuid NOT NULL, recipient_e164 varchar(16) NOT NULL, language varchar(20) NOT NULL,
        parameters jsonb NOT NULL DEFAULT '{}'::jsonb, operation_key varchar(255) NOT NULL, provider_message_id varchar(255),
        status varchar(30) NOT NULL DEFAULT 'CREATED', raw_provider_status varchar(100), attempt_count integer NOT NULL DEFAULT 0,
        accepted_at timestamptz, sent_at timestamptz, delivered_at timestamptz, read_at timestamptz, failed_at timestamptz,
        error_code varchar(100), error_description varchar(500), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_messages_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_messages_campaign FOREIGN KEY(campaign_id,organization_id) REFERENCES whatsapp_core.campaigns(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_messages_contact FOREIGN KEY(contact_id,organization_id) REFERENCES whatsapp_core.contacts(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_messages_sender FOREIGN KEY(sender_id,organization_id) REFERENCES whatsapp_core.whatsapp_phone_numbers(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_messages_template FOREIGN KEY(template_id,organization_id) REFERENCES whatsapp_core.message_templates(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_messages_id_org UNIQUE(id,organization_id), CONSTRAINT uq_messages_operation UNIQUE(organization_id,operation_key), CONSTRAINT uq_messages_provider UNIQUE(provider_message_id),
        CONSTRAINT ck_messages_phone CHECK(recipient_e164 ~ '^\\+[1-9][0-9]{1,14}$'),
        CONSTRAINT ck_messages_values CHECK(status IN ('CREATED','QUEUED','SUBMITTING','ACCEPTED','SENT','DELIVERED','READ','FAILED','CANCELLED','UNKNOWN_SUBMISSION') AND attempt_count BETWEEN 0 AND 20 AND jsonb_typeof(parameters)='object' AND octet_length(parameters::text)<=65536)
      );
      CREATE INDEX idx_messages_org_created ON whatsapp_core.messages(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_messages_campaign_status ON whatsapp_core.messages(organization_id,campaign_id,status);

      CREATE TABLE whatsapp_core.message_status_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, message_id uuid NOT NULL,
        deduplication_key char(64) NOT NULL, status varchar(30) NOT NULL, raw_status varchar(100), provider_timestamp timestamptz,
        error_code varchar(100), error_description varchar(500), received_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_status_message FOREIGN KEY(message_id,organization_id) REFERENCES whatsapp_core.messages(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT uq_status_event UNIQUE(deduplication_key)
      );
      CREATE INDEX idx_status_message_received ON whatsapp_core.message_status_events(message_id,received_at);

      CREATE TABLE whatsapp_core.campaign_schedules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, campaign_id uuid NOT NULL,
        scheduled_at timestamptz NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING', lease_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_schedule_campaign FOREIGN KEY(campaign_id,organization_id) REFERENCES whatsapp_core.campaigns(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT uq_schedule_campaign UNIQUE(campaign_id), CONSTRAINT ck_schedule_status CHECK(status IN ('PENDING','CLAIMED','DISPATCHED','CANCELLED'))
      );
      CREATE INDEX idx_schedules_due ON whatsapp_core.campaign_schedules(status,scheduled_at,lease_until);
      CREATE TABLE whatsapp_core.message_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, campaign_id uuid NOT NULL,
        sequence integer NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING', recipient_count integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        CONSTRAINT fk_batch_campaign FOREIGN KEY(campaign_id,organization_id) REFERENCES whatsapp_core.campaigns(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT uq_batch_sequence UNIQUE(campaign_id,sequence), CONSTRAINT ck_batch_values CHECK(sequence>=0 AND recipient_count>=0 AND status IN ('PENDING','PROCESSING','COMPLETED','FAILED'))
      );
      CREATE TABLE whatsapp_core.idempotency_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, scope varchar(100) NOT NULL, idempotency_key varchar(255) NOT NULL,
        resource_id uuid NOT NULL, request_hash char(64) NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_idempotency_scope UNIQUE(organization_id,scope,idempotency_key), CONSTRAINT ck_idempotency_hash CHECK(request_hash ~ '^[0-9a-f]{64}$')
      );
      CREATE INDEX idx_idempotency_expiry ON whatsapp_core.idempotency_records(expires_at);
      CREATE TABLE whatsapp_core.outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, aggregate_type varchar(50) NOT NULL,
        aggregate_id uuid NOT NULL, event_type varchar(100) NOT NULL, payload jsonb NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING',
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_outbox_event UNIQUE(aggregate_id,event_type), CONSTRAINT ck_outbox_values CHECK(status IN ('PENDING','PROCESSING','PROCESSED','FAILED','DEAD') AND attempts BETWEEN 0 AND 20 AND jsonb_typeof(payload)='object' AND octet_length(payload::text)<=65536)
      );
      CREATE INDEX idx_outbox_dispatch ON whatsapp_core.outbox_events(status,available_at,created_at);

      DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['contacts','contact_consents','contact_tags','contact_tag_mappings','contact_segments','contact_imports','contact_import_errors','campaigns','campaign_recipients','messages','message_status_events','campaign_schedules','message_batches','idempotency_records','outbox_events'] LOOP
        EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t);
        EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
        EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false)) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false))','tenant_isolation_'||t,t);
      END LOOP; END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.outbox_events,whatsapp_core.idempotency_records,whatsapp_core.message_batches,whatsapp_core.campaign_schedules,whatsapp_core.message_status_events,whatsapp_core.messages,whatsapp_core.campaign_recipients,whatsapp_core.campaigns,whatsapp_core.contact_import_errors,whatsapp_core.contact_imports,whatsapp_core.contact_segments,whatsapp_core.contact_tag_mappings,whatsapp_core.contact_tags,whatsapp_core.contact_consents,whatsapp_core.contacts CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_core.whatsapp_phone_numbers DROP CONSTRAINT IF EXISTS uq_whatsapp_phone_numbers_id_org`,
    );
  }
}
