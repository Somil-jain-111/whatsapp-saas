import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSaasBillingCore1792573800000 implements MigrationInterface {
  name = "CreateSaasBillingCore1792573800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres")
      throw new Error("Billing requires PostgreSQL");
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.subscription_plans (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar(50) NOT NULL, version integer NOT NULL,
        name varchar(100) NOT NULL, description varchar(1000), status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        trial_days integer NOT NULL DEFAULT 0, display_order integer NOT NULL DEFAULT 0,
        effective_from timestamptz NOT NULL, effective_to timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_subscription_plans_code_version UNIQUE(code,version),
        CONSTRAINT ck_subscription_plans_values CHECK (version > 0 AND trial_days BETWEEN 0 AND 365 AND status IN ('ACTIVE','INACTIVE') AND (effective_to IS NULL OR effective_to > effective_from))
      );
      CREATE INDEX idx_subscription_plans_active ON whatsapp_core.subscription_plans(status,display_order,effective_from);

      CREATE TABLE whatsapp_core.plan_prices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, country_code char(2), currency char(3) NOT NULL,
        interval varchar(20) NOT NULL, amount_minor bigint NOT NULL, provider varchar(30), provider_price_id varchar(255),
        tax_behavior varchar(20) NOT NULL DEFAULT 'UNSPECIFIED', status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        effective_from timestamptz NOT NULL, effective_to timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_plan_prices_plan FOREIGN KEY(plan_id) REFERENCES whatsapp_core.subscription_plans(id) ON DELETE RESTRICT,
        CONSTRAINT uq_plan_prices_version UNIQUE(plan_id,country_code,currency,interval,effective_from),
        CONSTRAINT uq_plan_prices_provider UNIQUE(provider,provider_price_id),
        CONSTRAINT ck_plan_prices_values CHECK (amount_minor >= 0 AND currency ~ '^[A-Z]{3}$' AND interval IN ('MONTH','YEAR') AND tax_behavior IN ('INCLUSIVE','EXCLUSIVE','UNSPECIFIED') AND status IN ('ACTIVE','INACTIVE') AND (effective_to IS NULL OR effective_to > effective_from))
      );
      CREATE INDEX idx_plan_prices_lookup ON whatsapp_core.plan_prices(currency,country_code,interval,status,effective_from DESC);

      CREATE TABLE whatsapp_core.plan_features (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, code varchar(100) NOT NULL,
        enabled boolean NOT NULL DEFAULT true, quota bigint, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_plan_features_plan FOREIGN KEY(plan_id) REFERENCES whatsapp_core.subscription_plans(id) ON DELETE CASCADE,
        CONSTRAINT uq_plan_features_code UNIQUE(plan_id,code), CONSTRAINT ck_plan_features_quota CHECK (quota IS NULL OR quota >= 0)
      );

      CREATE TABLE whatsapp_core.billing_customers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, provider varchar(30) NOT NULL,
        provider_customer_id varchar(255) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_billing_customers_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT uq_billing_customers_org_provider UNIQUE(organization_id,provider),
        CONSTRAINT uq_billing_customers_provider UNIQUE(provider,provider_customer_id), CONSTRAINT uq_billing_customers_id_org UNIQUE(id,organization_id)
      );

      CREATE TABLE whatsapp_core.subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, plan_id uuid NOT NULL, price_id uuid NOT NULL,
        billing_customer_id uuid, provider varchar(30), provider_subscription_id varchar(255), status varchar(30) NOT NULL,
        raw_provider_status varchar(100), current_period_start timestamptz, current_period_end timestamptz,
        trial_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false, cancelled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_subscriptions_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_subscriptions_plan FOREIGN KEY(plan_id) REFERENCES whatsapp_core.subscription_plans(id) ON DELETE RESTRICT,
        CONSTRAINT fk_subscriptions_price FOREIGN KEY(price_id) REFERENCES whatsapp_core.plan_prices(id) ON DELETE RESTRICT,
        CONSTRAINT fk_subscriptions_customer FOREIGN KEY(billing_customer_id,organization_id) REFERENCES whatsapp_core.billing_customers(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_subscriptions_provider UNIQUE(provider,provider_subscription_id), CONSTRAINT uq_subscriptions_id_org UNIQUE(id,organization_id),
        CONSTRAINT ck_subscriptions_status CHECK(status IN ('TRIALING','ACTIVE','PAST_DUE','PAUSED','CANCELLED','EXPIRED','INCOMPLETE')),
        CONSTRAINT ck_subscriptions_period CHECK(current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start)
      );
      CREATE UNIQUE INDEX uq_subscriptions_org_current ON whatsapp_core.subscriptions(organization_id) WHERE status IN ('TRIALING','ACTIVE','PAST_DUE','PAUSED','INCOMPLETE');
      CREATE INDEX idx_subscriptions_status_renewal ON whatsapp_core.subscriptions(status,current_period_end);

      CREATE TABLE whatsapp_core.payment_webhook_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider varchar(30) NOT NULL, provider_event_id varchar(255) NOT NULL,
        event_type varchar(100) NOT NULL, payload jsonb NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING',
        attempts integer NOT NULL DEFAULT 0, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
        CONSTRAINT uq_payment_webhook_event UNIQUE(provider,provider_event_id),
        CONSTRAINT ck_payment_webhook_payload CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144),
        CONSTRAINT ck_payment_webhook_status CHECK(status IN ('PENDING','PROCESSED','FAILED','IGNORED')), CONSTRAINT ck_payment_webhook_attempts CHECK(attempts BETWEEN 0 AND 20)
      );
      CREATE INDEX idx_payment_webhook_processing ON whatsapp_core.payment_webhook_events(status,received_at);

      CREATE TABLE whatsapp_core.payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, subscription_id uuid,
        provider varchar(30) NOT NULL, provider_payment_id varchar(255) NOT NULL, status varchar(30) NOT NULL,
        currency char(3) NOT NULL, amount_minor bigint NOT NULL, refunded_minor bigint NOT NULL DEFAULT 0,
        paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_payments_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_payments_subscription FOREIGN KEY(subscription_id,organization_id) REFERENCES whatsapp_core.subscriptions(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_payments_provider UNIQUE(provider,provider_payment_id),
        CONSTRAINT ck_payments_amounts CHECK(amount_minor>=0 AND refunded_minor>=0 AND refunded_minor<=amount_minor AND currency ~ '^[A-Z]{3}$')
      );
      CREATE INDEX idx_payments_org_created ON whatsapp_core.payments(organization_id,created_at DESC);

      CREATE TABLE whatsapp_core.invoices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, subscription_id uuid,
        provider varchar(30) NOT NULL, provider_invoice_id varchar(255) NOT NULL, invoice_number varchar(100),
        status varchar(30) NOT NULL, currency char(3) NOT NULL, subtotal_minor bigint NOT NULL, tax_minor bigint NOT NULL DEFAULT 0,
        total_minor bigint NOT NULL, hosted_url varchar(2048), pdf_url varchar(2048), issued_at timestamptz, due_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_invoices_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_invoices_subscription FOREIGN KEY(subscription_id,organization_id) REFERENCES whatsapp_core.subscriptions(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT uq_invoices_provider UNIQUE(provider,provider_invoice_id),
        CONSTRAINT ck_invoices_amounts CHECK(subtotal_minor>=0 AND tax_minor>=0 AND total_minor>=0 AND currency ~ '^[A-Z]{3}$')
      );
      CREATE INDEX idx_invoices_org_created ON whatsapp_core.invoices(organization_id,created_at DESC);

      CREATE TABLE whatsapp_core.usage_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, metric_code varchar(100) NOT NULL,
        quantity bigint NOT NULL, source_event_id varchar(255) NOT NULL, resource_type varchar(100), resource_id uuid,
        period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_usage_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT uq_usage_source UNIQUE(organization_id,metric_code,source_event_id),
        CONSTRAINT ck_usage_values CHECK(quantity<>0 AND period_end>period_start AND jsonb_typeof(metadata)='object' AND octet_length(metadata::text)<=16384)
      );
      CREATE INDEX idx_usage_org_period_metric ON whatsapp_core.usage_records(organization_id,period_start,period_end,metric_code);

      CREATE TABLE whatsapp_core.quota_reservations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, metric_code varchar(100) NOT NULL,
        quantity bigint NOT NULL, status varchar(20) NOT NULL DEFAULT 'RESERVED', idempotency_key varchar(255) NOT NULL,
        period_start timestamptz NOT NULL, period_end timestamptz NOT NULL, expires_at timestamptz NOT NULL,
        committed_at timestamptz, released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_quota_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT uq_quota_idempotency UNIQUE(organization_id,metric_code,idempotency_key),
        CONSTRAINT ck_quota_values CHECK(quantity>0 AND period_end>period_start AND expires_at>created_at AND status IN ('RESERVED','COMMITTED','RELEASED','EXPIRED'))
      );
      CREATE INDEX idx_quota_active ON whatsapp_core.quota_reservations(organization_id,metric_code,period_start,period_end) WHERE status IN ('RESERVED','COMMITTED');

      CREATE TABLE whatsapp_core.report_exports (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, requested_by_user_id uuid NOT NULL,
        type varchar(50) NOT NULL, format varchar(10) NOT NULL, filters jsonb NOT NULL DEFAULT '{}'::jsonb,
        status varchar(20) NOT NULL DEFAULT 'PENDING', object_key varchar(1024), expires_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        CONSTRAINT fk_report_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_report_user FOREIGN KEY(requested_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_report_values CHECK(format IN ('CSV','XLSX','PDF') AND status IN ('PENDING','RUNNING','COMPLETED','FAILED','EXPIRED') AND jsonb_typeof(filters)='object' AND octet_length(filters::text)<=32768)
      );
      CREATE INDEX idx_report_exports_org_status ON whatsapp_core.report_exports(organization_id,status,created_at DESC);

      DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['billing_customers','subscriptions','payments','invoices','usage_records','quota_reservations','report_exports'] LOOP
        EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
        EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false)) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false))','tenant_isolation_'||t,t);
      END LOOP; END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.report_exports,whatsapp_core.quota_reservations,whatsapp_core.usage_records,whatsapp_core.invoices,whatsapp_core.payments,whatsapp_core.payment_webhook_events,whatsapp_core.subscriptions,whatsapp_core.billing_customers,whatsapp_core.plan_features,whatsapp_core.plan_prices,whatsapp_core.subscription_plans CASCADE`,
    );
  }
}
