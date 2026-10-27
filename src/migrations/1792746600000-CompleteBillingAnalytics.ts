import { MigrationInterface, QueryRunner } from "typeorm";

export class CompleteBillingAnalytics1792746600000 implements MigrationInterface {
  name = "CompleteBillingAnalytics1792746600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.subscription_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, subscription_id uuid NOT NULL,
        event_type varchar(50) NOT NULL, from_status varchar(30), to_status varchar(30), provider_event_id varchar(255),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb, occurred_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_subscription_events_subscription FOREIGN KEY(subscription_id,organization_id) REFERENCES whatsapp_core.subscriptions(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_subscription_event_provider UNIQUE(provider_event_id),
        CONSTRAINT ck_subscription_event_metadata CHECK(jsonb_typeof(metadata)='object' AND octet_length(metadata::text)<=16384)
      );
      CREATE INDEX idx_subscription_events_org_time ON whatsapp_core.subscription_events(organization_id,occurred_at DESC);

      CREATE TABLE whatsapp_core.usage_aggregates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, metric_code varchar(100) NOT NULL,
        period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, quantity bigint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_usage_aggregates_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT uq_usage_aggregate UNIQUE(organization_id,metric_code,period_start,period_end),
        CONSTRAINT ck_usage_aggregate_period CHECK(period_end>period_start)
      );
      CREATE INDEX idx_usage_aggregates_org_period ON whatsapp_core.usage_aggregates(organization_id,period_start,period_end,metric_code);

      CREATE TABLE whatsapp_core.messaging_price_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_code char(2) NOT NULL, currency char(3) NOT NULL,
        category varchar(30) NOT NULL, pricing_unit varchar(30) NOT NULL DEFAULT 'MESSAGE', amount_minor bigint NOT NULL,
        source varchar(100) NOT NULL, source_version varchar(100) NOT NULL, effective_from timestamptz NOT NULL,
        effective_to timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_messaging_price_country FOREIGN KEY(country_code) REFERENCES whatsapp_core.iso_countries(code) ON DELETE RESTRICT,
        CONSTRAINT fk_messaging_price_currency FOREIGN KEY(currency) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT,
        CONSTRAINT uq_messaging_price_version UNIQUE(country_code,currency,category,effective_from),
        CONSTRAINT ck_messaging_price_values CHECK(amount_minor>=0 AND category IN ('MARKETING','UTILITY','AUTHENTICATION','SERVICE') AND pricing_unit IN ('MESSAGE','CONVERSATION') AND (effective_to IS NULL OR effective_to>effective_from))
      );
      CREATE INDEX idx_messaging_price_lookup ON whatsapp_core.messaging_price_versions(country_code,category,effective_from DESC);

      CREATE TABLE whatsapp_core.billing_adjustments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, payment_id uuid,
        type varchar(20) NOT NULL, currency char(3) NOT NULL, amount_minor bigint NOT NULL, reason varchar(500) NOT NULL,
        provider_reference varchar(255), approved_by_admin_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_adjustment_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_adjustment_payment FOREIGN KEY(payment_id) REFERENCES whatsapp_core.payments(id) ON DELETE RESTRICT,
        CONSTRAINT fk_adjustment_admin FOREIGN KEY(approved_by_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT ck_adjustment_values CHECK(type IN ('CREDIT','REFUND','DEBIT') AND amount_minor>0 AND length(btrim(reason)) BETWEEN 1 AND 500)
      );
      CREATE INDEX idx_billing_adjustments_org_created ON whatsapp_core.billing_adjustments(organization_id,created_at DESC);

      CREATE TABLE whatsapp_core.billing_notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, type varchar(50) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb, status varchar(20) NOT NULL DEFAULT 'PENDING',
        attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_billing_notifications_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT ck_billing_notification_values CHECK(status IN ('PENDING','PROCESSING','SENT','FAILED','DEAD') AND attempts BETWEEN 0 AND 20 AND jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16384)
      );
      CREATE INDEX idx_billing_notifications_dispatch ON whatsapp_core.billing_notifications(status,available_at);

      DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['subscription_events','usage_aggregates','billing_adjustments','billing_notifications'] LOOP
        EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t);
        EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
        EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false)) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false))','tenant_isolation_'||t,t);
      END LOOP; END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.billing_notifications,whatsapp_core.billing_adjustments,whatsapp_core.messaging_price_versions,whatsapp_core.usage_aggregates,whatsapp_core.subscription_events CASCADE`,
    );
  }
}
