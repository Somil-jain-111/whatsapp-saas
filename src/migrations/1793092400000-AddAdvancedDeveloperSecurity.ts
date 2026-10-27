import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvancedDeveloperSecurity1793092400000 implements MigrationInterface {
  name = "AddAdvancedDeveloperSecurity1793092400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.organizations
        ADD COLUMN api_monthly_spend_cap_minor bigint,
        ADD CONSTRAINT ck_organizations_api_spend_cap CHECK(api_monthly_spend_cap_minor IS NULL OR api_monthly_spend_cap_minor>=0);

      ALTER TABLE whatsapp_core.api_keys
        ADD COLUMN signing_secret_ciphertext bytea,
        ADD COLUMN signing_secret_nonce bytea,
        ADD COLUMN signing_secret_auth_tag bytea,
        ADD COLUMN signing_key_version varchar(50),
        ADD COLUMN mtls_required boolean NOT NULL DEFAULT false,
        ADD CONSTRAINT ck_api_key_signing_secret CHECK(
          (signing_secret_ciphertext IS NULL AND signing_secret_nonce IS NULL AND signing_secret_auth_tag IS NULL AND signing_key_version IS NULL)
          OR
          (signing_secret_ciphertext IS NOT NULL AND signing_secret_nonce IS NOT NULL AND signing_secret_auth_tag IS NOT NULL AND signing_key_version IS NOT NULL)
        );

      CREATE TABLE whatsapp_core.api_key_mtls_fingerprints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE,
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        fingerprint_sha256 char(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_key_mtls_fingerprint UNIQUE(api_key_id,fingerprint_sha256),
        CONSTRAINT ck_api_key_mtls_fingerprint CHECK(fingerprint_sha256 ~ '^[0-9a-f]{64}$')
      );
      CREATE INDEX idx_api_key_mtls_org_key ON whatsapp_core.api_key_mtls_fingerprints(organization_id,api_key_id);

      CREATE TABLE whatsapp_core.api_spend_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        api_key_id uuid NOT NULL REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT,
        operation_key varchar(255) NOT NULL,
        currency char(3) NOT NULL REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT,
        amount_minor bigint NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'RESERVED',
        period_start timestamptz NOT NULL,
        period_end timestamptz NOT NULL,
        expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
        committed_at timestamptz,
        released_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_api_spend_operation UNIQUE(organization_id,operation_key),
        CONSTRAINT ck_api_spend_amount CHECK(amount_minor>=0),
        CONSTRAINT ck_api_spend_status CHECK(status IN ('RESERVED','COMMITTED','RELEASED')),
        CONSTRAINT ck_api_spend_period CHECK(period_end>period_start),
        CONSTRAINT ck_api_spend_terminal CHECK(
          (status='RESERVED' AND committed_at IS NULL AND released_at IS NULL) OR
          (status='COMMITTED' AND committed_at IS NOT NULL AND released_at IS NULL) OR
          (status='RELEASED' AND released_at IS NOT NULL AND committed_at IS NULL)
        )
      );
      CREATE INDEX idx_api_spend_org_period ON whatsapp_core.api_spend_reservations(organization_id,period_start,status);
      CREATE INDEX idx_api_spend_expiry ON whatsapp_core.api_spend_reservations(expires_at) WHERE status='RESERVED';

      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_api_key_mtls_fingerprints ON whatsapp_core.api_key_mtls_fingerprints
        USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false))
        WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false));

      ALTER TABLE whatsapp_core.api_spend_reservations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.api_spend_reservations FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_api_spend_reservations ON whatsapp_core.api_spend_reservations
        USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false))
        WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TABLE IF EXISTS whatsapp_core.api_spend_reservations;
      DROP TABLE IF EXISTS whatsapp_core.api_key_mtls_fingerprints;
      ALTER TABLE whatsapp_core.api_keys
        DROP CONSTRAINT IF EXISTS ck_api_key_signing_secret,
        DROP COLUMN IF EXISTS mtls_required,
        DROP COLUMN IF EXISTS signing_key_version,
        DROP COLUMN IF EXISTS signing_secret_auth_tag,
        DROP COLUMN IF EXISTS signing_secret_nonce,
        DROP COLUMN IF EXISTS signing_secret_ciphertext;
      ALTER TABLE whatsapp_core.organizations
        DROP CONSTRAINT IF EXISTS ck_organizations_api_spend_cap,
        DROP COLUMN IF EXISTS api_monthly_spend_cap_minor;
    `);
  }
}
