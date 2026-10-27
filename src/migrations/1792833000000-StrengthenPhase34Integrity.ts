import { MigrationInterface, QueryRunner } from "typeorm";

export class StrengthenPhase34Integrity1792833000000 implements MigrationInterface {
  name = "StrengthenPhase34Integrity1792833000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.plan_prices
        ADD CONSTRAINT fk_plan_prices_country FOREIGN KEY(country_code) REFERENCES whatsapp_core.iso_countries(code) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_plan_prices_currency FOREIGN KEY(currency) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.payments
        ADD CONSTRAINT fk_payments_currency FOREIGN KEY(currency) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.invoices
        ADD CONSTRAINT fk_invoices_currency FOREIGN KEY(currency) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.billing_adjustments
        ADD CONSTRAINT fk_billing_adjustments_currency FOREIGN KEY(currency) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.report_exports
        ADD CONSTRAINT ck_report_export_type CHECK(type IN ('CAMPAIGN','MESSAGES','TEMPLATES','USAGE','BILLING','PAYMENTS'));
      ALTER TABLE whatsapp_core.message_status_events
        ADD CONSTRAINT ck_message_status_event_status CHECK(status IN ('CREATED','QUEUED','SUBMITTING','ACCEPTED','SENT','DELIVERED','READ','FAILED','CANCELLED','UNKNOWN_SUBMISSION'));
      ALTER TABLE whatsapp_core.contact_imports
        ADD CONSTRAINT ck_contact_import_totals CHECK(accepted_rows+rejected_rows<=total_rows);
      ALTER TABLE whatsapp_core.usage_aggregates
        ADD CONSTRAINT ck_usage_aggregates_quantity CHECK(quantity>=0);
      CREATE UNIQUE INDEX uq_billing_notification_quota_period
        ON whatsapp_core.billing_notifications(organization_id,type,(payload->>'metricCode'),(payload->>'periodEnd'))
        WHERE type='QUOTA_WARNING';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS whatsapp_core.uq_billing_notification_quota_period;
      ALTER TABLE whatsapp_core.usage_aggregates DROP CONSTRAINT IF EXISTS ck_usage_aggregates_quantity;
      ALTER TABLE whatsapp_core.contact_imports DROP CONSTRAINT IF EXISTS ck_contact_import_totals;
      ALTER TABLE whatsapp_core.message_status_events DROP CONSTRAINT IF EXISTS ck_message_status_event_status;
      ALTER TABLE whatsapp_core.report_exports DROP CONSTRAINT IF EXISTS ck_report_export_type;
      ALTER TABLE whatsapp_core.billing_adjustments DROP CONSTRAINT IF EXISTS fk_billing_adjustments_currency;
      ALTER TABLE whatsapp_core.invoices DROP CONSTRAINT IF EXISTS fk_invoices_currency;
      ALTER TABLE whatsapp_core.payments DROP CONSTRAINT IF EXISTS fk_payments_currency;
      ALTER TABLE whatsapp_core.plan_prices DROP CONSTRAINT IF EXISTS fk_plan_prices_currency, DROP CONSTRAINT IF EXISTS fk_plan_prices_country;
    `);
  }
}
