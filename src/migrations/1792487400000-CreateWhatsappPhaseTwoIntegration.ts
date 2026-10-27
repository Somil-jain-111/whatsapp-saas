import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWhatsappPhaseTwoIntegration1792487400000 implements MigrationInterface {
  name = "CreateWhatsappPhaseTwoIntegration1792487400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") {
      throw new Error("WhatsApp Phase 2 requires PostgreSQL");
    }
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.meta_connections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        status varchar(40) NOT NULL DEFAULT 'CONNECTING', provider_business_id varchar(64),
        credential_ciphertext bytea, credential_nonce bytea, credential_auth_tag bytea, key_version varchar(100),
        credential_created_at timestamptz, credential_rotated_at timestamptz, token_expires_at timestamptz,
        last_synced_at timestamptz, last_failed_at timestamptz, disconnected_at timestamptz,
        disconnect_reason varchar(500), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_meta_connections_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT uq_meta_connections_id_org UNIQUE (id, organization_id),
        CONSTRAINT ck_meta_connections_status CHECK (status IN ('CONNECTING','CONNECTED','ACTION_REQUIRED','DEGRADED','DISCONNECTED','REVOKED')),
        CONSTRAINT ck_meta_connections_credential CHECK (
          (credential_ciphertext IS NULL AND credential_nonce IS NULL AND credential_auth_tag IS NULL AND key_version IS NULL AND credential_created_at IS NULL)
          OR (credential_ciphertext IS NOT NULL AND octet_length(credential_nonce) = 12 AND octet_length(credential_auth_tag) = 16 AND key_version IS NOT NULL AND credential_created_at IS NOT NULL)
        ),
        CONSTRAINT ck_meta_connections_disconnected CHECK (status NOT IN ('DISCONNECTED','REVOKED') OR disconnected_at IS NOT NULL)
      );
      CREATE INDEX idx_meta_connections_org_status ON whatsapp_core.meta_connections(organization_id, status);
      CREATE INDEX idx_meta_connections_sync ON whatsapp_core.meta_connections(last_synced_at) WHERE status IN ('CONNECTED','DEGRADED');

      CREATE TABLE whatsapp_core.meta_onboarding_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, created_by_user_id uuid NOT NULL,
        state_hash char(64) NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_meta_onboarding_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_meta_onboarding_user FOREIGN KEY (created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE CASCADE,
        CONSTRAINT uq_meta_onboarding_state_hash UNIQUE (state_hash),
        CONSTRAINT ck_meta_onboarding_state_hash CHECK (state_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_meta_onboarding_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_meta_onboarding_consumed CHECK (consumed_at IS NULL OR consumed_at >= created_at)
      );
      CREATE INDEX idx_meta_onboarding_org_expires ON whatsapp_core.meta_onboarding_sessions(organization_id, expires_at);

      CREATE TABLE whatsapp_core.whatsapp_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, connection_id uuid NOT NULL,
        provider_account_id varchar(64) NOT NULL, business_name varchar(200), status varchar(40) NOT NULL DEFAULT 'UNKNOWN',
        verification_status varchar(40), last_synced_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_whatsapp_accounts_id_org UNIQUE (id, organization_id),
        CONSTRAINT uq_whatsapp_accounts_provider_id UNIQUE (provider_account_id),
        CONSTRAINT fk_whatsapp_accounts_connection FOREIGN KEY (connection_id, organization_id)
          REFERENCES whatsapp_core.meta_connections(id, organization_id) ON DELETE RESTRICT
      );
      CREATE INDEX idx_whatsapp_accounts_org_status ON whatsapp_core.whatsapp_accounts(organization_id, status);

      CREATE TABLE whatsapp_core.whatsapp_phone_numbers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, account_id uuid NOT NULL,
        provider_phone_number_id varchar(64) NOT NULL, display_phone_number varchar(64) NOT NULL, phone_e164 varchar(16),
        verified_display_name varchar(200), quality_rating varchar(40), messaging_limit varchar(100),
        status varchar(40) NOT NULL DEFAULT 'UNKNOWN', is_default boolean NOT NULL DEFAULT false,
        last_synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_whatsapp_phone_numbers_provider_id UNIQUE (provider_phone_number_id),
        CONSTRAINT fk_whatsapp_phone_account FOREIGN KEY (account_id, organization_id)
          REFERENCES whatsapp_core.whatsapp_accounts(id, organization_id) ON DELETE RESTRICT,
        CONSTRAINT ck_whatsapp_phone_e164 CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$')
      );
      CREATE INDEX idx_whatsapp_phone_org_account ON whatsapp_core.whatsapp_phone_numbers(organization_id, account_id);
      CREATE UNIQUE INDEX uq_whatsapp_phone_default_per_org ON whatsapp_core.whatsapp_phone_numbers(organization_id) WHERE is_default;

      CREATE TABLE whatsapp_core.message_templates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, account_id uuid NOT NULL,
        provider_template_id varchar(64), name varchar(512) NOT NULL, language varchar(20) NOT NULL, category varchar(30) NOT NULL,
        local_status varchar(40) NOT NULL DEFAULT 'DRAFT', meta_status varchar(40), raw_provider_status varchar(100),
        rejection_reason varchar(1000), current_version integer NOT NULL DEFAULT 1, provider_deleted_at timestamptz,
        archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_message_templates_id_org UNIQUE (id, organization_id),
        CONSTRAINT uq_message_templates_org_account_name_language UNIQUE (organization_id, account_id, name, language),
        CONSTRAINT uq_message_templates_provider_id UNIQUE (provider_template_id),
        CONSTRAINT fk_message_templates_account FOREIGN KEY (account_id, organization_id)
          REFERENCES whatsapp_core.whatsapp_accounts(id, organization_id) ON DELETE RESTRICT,
        CONSTRAINT ck_message_templates_name CHECK (name ~ '^[a-z0-9_]+$'),
        CONSTRAINT ck_message_templates_language CHECK (language ~ '^[A-Za-z]{2,3}([_-][A-Za-z]{2})?$'),
        CONSTRAINT ck_message_templates_category CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
        CONSTRAINT ck_message_templates_local_status CHECK (local_status IN ('DRAFT','SUBMITTING','SUBMISSION_FAILED','SUBMITTED','ARCHIVED')),
        CONSTRAINT ck_message_templates_version CHECK (current_version > 0)
      );
      CREATE INDEX idx_message_templates_org_status ON whatsapp_core.message_templates(organization_id, local_status, meta_status);
      CREATE INDEX idx_message_templates_updated ON whatsapp_core.message_templates(organization_id, updated_at DESC, id DESC);

      CREATE TABLE whatsapp_core.template_components (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, template_id uuid NOT NULL,
        version integer NOT NULL, position integer NOT NULL, type varchar(30) NOT NULL, payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_template_components_version_position UNIQUE (template_id, version, position),
        CONSTRAINT fk_template_components_template FOREIGN KEY (template_id, organization_id)
          REFERENCES whatsapp_core.message_templates(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_template_components_type CHECK (type IN ('HEADER','BODY','FOOTER','BUTTONS')),
        CONSTRAINT ck_template_components_numbers CHECK (version > 0 AND position >= 0),
        CONSTRAINT ck_template_components_payload CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536)
      );

      CREATE TABLE whatsapp_core.template_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, template_id uuid NOT NULL,
        version integer NOT NULL, snapshot jsonb NOT NULL, created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_template_versions_number UNIQUE (template_id, version),
        CONSTRAINT fk_template_versions_template FOREIGN KEY (template_id, organization_id)
          REFERENCES whatsapp_core.message_templates(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_template_versions_user FOREIGN KEY (created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_template_versions_number CHECK (version > 0),
        CONSTRAINT ck_template_versions_snapshot CHECK (jsonb_typeof(snapshot) = 'object' AND octet_length(snapshot::text) <= 131072)
      );

      CREATE TABLE whatsapp_core.meta_webhook_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, deduplication_key char(64) NOT NULL,
        payload jsonb NOT NULL, status varchar(30) NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0,
        next_attempt_at timestamptz, processed_at timestamptz, expires_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_meta_webhook_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE SET NULL,
        CONSTRAINT uq_meta_webhook_dedup UNIQUE (deduplication_key),
        CONSTRAINT ck_meta_webhook_dedup CHECK (deduplication_key ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_meta_webhook_status CHECK (status IN ('PENDING','PROCESSING','PROCESSED','FAILED','IGNORED')),
        CONSTRAINT ck_meta_webhook_attempts CHECK (attempts >= 0 AND attempts <= 20),
        CONSTRAINT ck_meta_webhook_payload CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 1048576)
      );
      CREATE INDEX idx_meta_webhook_processing ON whatsapp_core.meta_webhook_events(status, next_attempt_at, received_at);
      CREATE INDEX idx_meta_webhook_expiry ON whatsapp_core.meta_webhook_events(expires_at);

      CREATE TABLE whatsapp_core.integration_sync_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, connection_id uuid,
        type varchar(50) NOT NULL, status varchar(30) NOT NULL DEFAULT 'PENDING', cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_integration_sync_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_integration_sync_connection FOREIGN KEY (connection_id, organization_id)
          REFERENCES whatsapp_core.meta_connections(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_integration_sync_type CHECK (type IN ('CONNECTION','ACCOUNTS','PHONE_NUMBERS','TEMPLATES','RECONCILE_SUBMISSION')),
        CONSTRAINT ck_integration_sync_status CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','DEAD')),
        CONSTRAINT ck_integration_sync_attempts CHECK (attempts >= 0 AND attempts <= 20),
        CONSTRAINT ck_integration_sync_cursor CHECK (jsonb_typeof(cursor) = 'object' AND octet_length(cursor::text) <= 16384)
      );
      CREATE INDEX idx_integration_sync_jobs_run ON whatsapp_core.integration_sync_jobs(status, available_at);
      CREATE INDEX idx_integration_sync_jobs_org_created ON whatsapp_core.integration_sync_jobs(organization_id, created_at DESC);

      CREATE TABLE whatsapp_core.integration_errors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, connection_id uuid,
        code varchar(100) NOT NULL, message varchar(1000) NOT NULL, context jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurrence_count integer NOT NULL DEFAULT 1, resolved_at timestamptz, occurred_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_integration_errors_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_integration_errors_connection FOREIGN KEY (connection_id, organization_id)
          REFERENCES whatsapp_core.meta_connections(id, organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_integration_errors_count CHECK (occurrence_count > 0),
        CONSTRAINT ck_integration_errors_context CHECK (jsonb_typeof(context) = 'object' AND octet_length(context::text) <= 32768)
      );
      CREATE INDEX idx_integration_errors_org_occurred ON whatsapp_core.integration_errors(organization_id, occurred_at DESC);
      CREATE INDEX idx_integration_errors_unresolved ON whatsapp_core.integration_errors(occurred_at DESC) WHERE resolved_at IS NULL;

      DO $$
      DECLARE table_name text;
      BEGIN
        FOREACH table_name IN ARRAY ARRAY[
          'meta_connections','meta_onboarding_sessions','whatsapp_accounts','whatsapp_phone_numbers',
          'message_templates','template_components','template_versions','integration_sync_jobs','integration_errors'
        ] LOOP
          EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY', table_name);
          EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY', table_name);
          EXECUTE format(
            'CREATE POLICY %I ON whatsapp_core.%I USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'', true), '''')::boolean, false)) WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'', true), '''')::boolean, false))',
            'tenant_isolation_' || table_name, table_name
          );
        END LOOP;
      END $$;

      ALTER TABLE whatsapp_core.meta_webhook_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.meta_webhook_events FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_meta_webhook_events ON whatsapp_core.meta_webhook_events
        USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false))
        WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS whatsapp_core.integration_errors;
      DROP TABLE IF EXISTS whatsapp_core.integration_sync_jobs;
      DROP TABLE IF EXISTS whatsapp_core.meta_webhook_events;
      DROP TABLE IF EXISTS whatsapp_core.template_versions;
      DROP TABLE IF EXISTS whatsapp_core.template_components;
      DROP TABLE IF EXISTS whatsapp_core.message_templates;
      DROP TABLE IF EXISTS whatsapp_core.whatsapp_phone_numbers;
      DROP TABLE IF EXISTS whatsapp_core.whatsapp_accounts;
      DROP TABLE IF EXISTS whatsapp_core.meta_onboarding_sessions;
      DROP TABLE IF EXISTS whatsapp_core.meta_connections;
    `);
  }
}
