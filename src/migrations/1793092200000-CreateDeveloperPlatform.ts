import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDeveloperPlatform1793092200000 implements MigrationInterface {
  name = "CreateDeveloperPlatform1793092200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.organizations
        ADD COLUMN api_access_enabled boolean NOT NULL DEFAULT true;

      CREATE TABLE whatsapp_core.api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        name varchar(100) NOT NULL,
        public_id varchar(32) NOT NULL,
        secret_verifier char(64) NOT NULL,
        environment varchar(10) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        expires_at timestamptz,
        last_used_at timestamptz,
        created_by_user_id uuid NOT NULL REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        rotated_from_id uuid REFERENCES whatsapp_core.api_keys(id) ON DELETE SET NULL,
        revoked_at timestamptz,
        revoked_by_user_id uuid REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        revoke_reason varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_keys_public_id UNIQUE(public_id),
        CONSTRAINT ck_api_keys_environment CHECK(environment IN ('LIVE','TEST')),
        CONSTRAINT ck_api_keys_status CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
        CONSTRAINT ck_api_keys_expiry CHECK(expires_at IS NULL OR expires_at > created_at),
        CONSTRAINT ck_api_keys_revocation CHECK((status='REVOKED')=(revoked_at IS NOT NULL))
      );
      CREATE INDEX idx_api_keys_org_created ON whatsapp_core.api_keys(organization_id,created_at DESC);
      CREATE INDEX idx_api_keys_org_status ON whatsapp_core.api_keys(organization_id,status,environment);

      CREATE TABLE whatsapp_core.api_key_scopes (
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        scope varchar(50) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(api_key_id,scope),
        CONSTRAINT ck_api_key_scope CHECK(scope IN ('messages:send','messages:read','templates:read','contacts:read','contacts:write','campaigns:read','campaigns:manage','reports:read','webhooks:manage'))
      );
      CREATE INDEX idx_api_key_scopes_org ON whatsapp_core.api_key_scopes(organization_id,scope);

      CREATE TABLE whatsapp_core.api_key_ip_allowlists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        network cidr NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_key_network UNIQUE(api_key_id,network)
      );
      CREATE INDEX idx_api_key_ip_org_key ON whatsapp_core.api_key_ip_allowlists(organization_id,api_key_id);

      CREATE TABLE whatsapp_core.api_request_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id uuid NOT NULL,
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT,
        endpoint varchar(160) NOT NULL,
        method varchar(10) NOT NULL,
        status_code smallint NOT NULL,
        latency_ms integer NOT NULL,
        source_ip inet,
        error_code varchar(80),
        environment varchar(10) NOT NULL,
        message_operation_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_request_id UNIQUE(request_id),
        CONSTRAINT ck_api_request_status CHECK(status_code BETWEEN 100 AND 599),
        CONSTRAINT ck_api_request_latency CHECK(latency_ms >= 0),
        CONSTRAINT ck_api_request_environment CHECK(environment IN ('LIVE','TEST'))
      );
      CREATE INDEX idx_api_request_org_created ON whatsapp_core.api_request_logs(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_api_request_key_created ON whatsapp_core.api_request_logs(api_key_id,created_at DESC);
      CREATE INDEX idx_api_request_error_created ON whatsapp_core.api_request_logs(organization_id,error_code,created_at DESC) WHERE error_code IS NOT NULL;

      CREATE TABLE whatsapp_core.public_idempotency_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT,
        operation varchar(80) NOT NULL,
        idempotency_key varchar(200) NOT NULL,
        request_fingerprint char(64) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PROCESSING',
        response_status smallint,
        response_body jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
        CONSTRAINT uq_public_idempotency UNIQUE(organization_id,api_key_id,operation,idempotency_key),
        CONSTRAINT ck_public_idempotency_status CHECK(status IN ('PROCESSING','COMPLETED','FAILED'))
      );
      CREATE INDEX idx_public_idempotency_expiry ON whatsapp_core.public_idempotency_records(expires_at);

      CREATE TABLE whatsapp_core.developer_webhook_endpoints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        name varchar(100) NOT NULL,
        url varchar(2048) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        secret_ciphertext bytea NOT NULL,
        secret_nonce bytea NOT NULL,
        secret_auth_tag bytea NOT NULL,
        key_version varchar(50) NOT NULL,
        consecutive_failures integer NOT NULL DEFAULT 0,
        disabled_at timestamptz,
        created_by_user_id uuid NOT NULL REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_developer_webhook_url CHECK(url ~ '^https://'),
        CONSTRAINT ck_developer_webhook_status CHECK(status IN ('ACTIVE','DISABLED','REVOKED')),
        CONSTRAINT ck_developer_webhook_failures CHECK(consecutive_failures >= 0)
      );
      CREATE INDEX idx_developer_webhook_org ON whatsapp_core.developer_webhook_endpoints(organization_id,created_at DESC);

      CREATE TABLE whatsapp_core.developer_webhook_subscriptions (
        endpoint_id uuid NOT NULL REFERENCES whatsapp_core.developer_webhook_endpoints(id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        event_type varchar(60) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(endpoint_id,event_type),
        CONSTRAINT ck_developer_webhook_event CHECK(event_type IN ('message.accepted','message.sent','message.delivered','message.read','message.failed','campaign.started','campaign.completed','campaign.failed'))
      );

      CREATE TABLE whatsapp_core.developer_webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        endpoint_id uuid NOT NULL REFERENCES whatsapp_core.developer_webhook_endpoints(id) ON DELETE RESTRICT,
        event_id uuid NOT NULL,
        event_type varchar(60) NOT NULL,
        payload jsonb NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING',
        attempt_count smallint NOT NULL DEFAULT 0,
        response_status smallint,
        error_code varchar(80),
        next_attempt_at timestamptz NOT NULL DEFAULT now(),
        delivered_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_webhook_delivery_event UNIQUE(endpoint_id,event_id),
        CONSTRAINT ck_webhook_delivery_status CHECK(status IN ('PENDING','DELIVERED','FAILED','DEAD')),
        CONSTRAINT ck_webhook_attempts CHECK(attempt_count BETWEEN 0 AND 8)
      );
      CREATE INDEX idx_webhook_delivery_org_created ON whatsapp_core.developer_webhook_deliveries(organization_id,created_at DESC);
      CREATE INDEX idx_webhook_delivery_due ON whatsapp_core.developer_webhook_deliveries(status,next_attempt_at) WHERE status IN ('PENDING','FAILED');

      CREATE TABLE whatsapp_core.api_security_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        api_key_id uuid REFERENCES whatsapp_core.api_keys(id) ON DELETE SET NULL,
        event_type varchar(80) NOT NULL,
        severity varchar(10) NOT NULL,
        source_ip inet,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_api_security_severity CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL'))
      );
      CREATE INDEX idx_api_security_org_created ON whatsapp_core.api_security_events(organization_id,created_at DESC);
      CREATE INDEX idx_api_security_severity ON whatsapp_core.api_security_events(severity,created_at DESC);

      CREATE TABLE whatsapp_core.api_sandbox_scenarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(50) NOT NULL UNIQUE,
        description varchar(255) NOT NULL,
        terminal_status varchar(20) NOT NULL,
        delay_ms integer NOT NULL DEFAULT 500,
        enabled boolean NOT NULL DEFAULT true,
        CONSTRAINT ck_sandbox_status CHECK(terminal_status IN ('DELIVERED','READ','FAILED')),
        CONSTRAINT ck_sandbox_delay CHECK(delay_ms BETWEEN 0 AND 30000)
      );
      INSERT INTO whatsapp_core.api_sandbox_scenarios(code,description,terminal_status,delay_ms) VALUES
        ('delivered','Simulates accepted, sent and delivered','DELIVERED',500),
        ('read','Simulates accepted, sent, delivered and read','READ',750),
        ('failed','Simulates a provider rejection','FAILED',300);

      INSERT INTO whatsapp_core.permissions(code,name) VALUES
        ('developer.api_key.read','Read developer API credentials'),
        ('developer.api_key.manage','Manage developer API credentials'),
        ('developer.usage.read','Read public API usage and logs'),
        ('developer.webhook.manage','Manage developer webhooks'),
        ('platform.api.manage','Manage tenant public API access')
      ON CONFLICT(code) DO UPDATE SET name=excluded.name,status='ACTIVE';
      INSERT INTO whatsapp_core.role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM whatsapp_core.roles r CROSS JOIN whatsapp_core.permissions p
       WHERE r.code IN ('owner','admin','platform.super_admin')
         AND p.code IN ('developer.api_key.read','developer.api_key.manage','developer.usage.read','developer.webhook.manage','platform.api.manage')
      ON CONFLICT DO NOTHING;

      ${[
        "api_keys",
        "api_key_scopes",
        "api_key_ip_allowlists",
        "api_request_logs",
        "public_idempotency_records",
        "developer_webhook_endpoints",
        "developer_webhook_subscriptions",
        "developer_webhook_deliveries",
      ]
        .map(
          (table) => `
          ALTER TABLE whatsapp_core.${table} ENABLE ROW LEVEL SECURITY;
          ALTER TABLE whatsapp_core.${table} FORCE ROW LEVEL SECURITY;
          CREATE POLICY tenant_isolation_${table} ON whatsapp_core.${table}
            USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false))
            WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false));`,
        )
        .join("\n")}
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TABLE IF EXISTS whatsapp_core.api_sandbox_scenarios;
      DROP TABLE IF EXISTS whatsapp_core.api_security_events;
      DROP TABLE IF EXISTS whatsapp_core.developer_webhook_deliveries;
      DROP TABLE IF EXISTS whatsapp_core.developer_webhook_subscriptions;
      DROP TABLE IF EXISTS whatsapp_core.developer_webhook_endpoints;
      DROP TABLE IF EXISTS whatsapp_core.public_idempotency_records;
      DROP TABLE IF EXISTS whatsapp_core.api_request_logs;
      DROP TABLE IF EXISTS whatsapp_core.api_key_ip_allowlists;
      DROP TABLE IF EXISTS whatsapp_core.api_key_scopes;
      DROP TABLE IF EXISTS whatsapp_core.api_keys;
      ALTER TABLE whatsapp_core.organizations DROP COLUMN IF EXISTS api_access_enabled;
    `);
  }
}
