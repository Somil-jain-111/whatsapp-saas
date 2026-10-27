import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenDeveloperTenantForeignKeys1793092500000 implements MigrationInterface {
  name = "HardenDeveloperTenantForeignKeys1793092500000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.api_keys ADD CONSTRAINT uq_api_keys_id_org UNIQUE(id,organization_id);
      ALTER TABLE whatsapp_core.developer_webhook_endpoints ADD CONSTRAINT uq_developer_webhook_endpoint_id_org UNIQUE(id,organization_id);

      ALTER TABLE whatsapp_core.api_key_scopes DROP CONSTRAINT api_key_scopes_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_key_scopes ADD CONSTRAINT fk_api_key_scopes_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.api_key_ip_allowlists DROP CONSTRAINT api_key_ip_allowlists_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_key_ip_allowlists ADD CONSTRAINT fk_api_key_ip_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.api_request_logs DROP CONSTRAINT api_request_logs_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_request_logs ADD CONSTRAINT fk_api_request_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.public_idempotency_records DROP CONSTRAINT public_idempotency_records_api_key_id_fkey;
      ALTER TABLE whatsapp_core.public_idempotency_records ADD CONSTRAINT fk_public_idempotency_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints DROP CONSTRAINT api_key_mtls_fingerprints_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints ADD CONSTRAINT fk_api_key_mtls_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.api_spend_reservations DROP CONSTRAINT api_spend_reservations_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_spend_reservations ADD CONSTRAINT fk_api_spend_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.api_security_events DROP CONSTRAINT api_security_events_api_key_id_fkey;
      ALTER TABLE whatsapp_core.api_security_events ADD CONSTRAINT fk_api_security_key_org FOREIGN KEY(api_key_id,organization_id) REFERENCES whatsapp_core.api_keys(id,organization_id) ON DELETE SET NULL (api_key_id,organization_id);

      ALTER TABLE whatsapp_core.developer_webhook_subscriptions DROP CONSTRAINT developer_webhook_subscriptions_endpoint_id_fkey;
      ALTER TABLE whatsapp_core.developer_webhook_subscriptions ADD CONSTRAINT fk_webhook_subscription_endpoint_org FOREIGN KEY(endpoint_id,organization_id) REFERENCES whatsapp_core.developer_webhook_endpoints(id,organization_id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.developer_webhook_deliveries DROP CONSTRAINT developer_webhook_deliveries_endpoint_id_fkey;
      ALTER TABLE whatsapp_core.developer_webhook_deliveries ADD CONSTRAINT fk_webhook_delivery_endpoint_org FOREIGN KEY(endpoint_id,organization_id) REFERENCES whatsapp_core.developer_webhook_endpoints(id,organization_id) ON DELETE RESTRICT;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.developer_webhook_deliveries DROP CONSTRAINT fk_webhook_delivery_endpoint_org;
      ALTER TABLE whatsapp_core.developer_webhook_deliveries ADD FOREIGN KEY(endpoint_id) REFERENCES whatsapp_core.developer_webhook_endpoints(id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.developer_webhook_subscriptions DROP CONSTRAINT fk_webhook_subscription_endpoint_org;
      ALTER TABLE whatsapp_core.developer_webhook_subscriptions ADD FOREIGN KEY(endpoint_id) REFERENCES whatsapp_core.developer_webhook_endpoints(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.api_security_events DROP CONSTRAINT fk_api_security_key_org;
      ALTER TABLE whatsapp_core.api_security_events ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE SET NULL;
      ALTER TABLE whatsapp_core.api_spend_reservations DROP CONSTRAINT fk_api_spend_key_org;
      ALTER TABLE whatsapp_core.api_spend_reservations ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints DROP CONSTRAINT fk_api_key_mtls_key_org;
      ALTER TABLE whatsapp_core.api_key_mtls_fingerprints ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.public_idempotency_records DROP CONSTRAINT fk_public_idempotency_key_org;
      ALTER TABLE whatsapp_core.public_idempotency_records ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.api_request_logs DROP CONSTRAINT fk_api_request_key_org;
      ALTER TABLE whatsapp_core.api_request_logs ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.api_key_ip_allowlists DROP CONSTRAINT fk_api_key_ip_key_org;
      ALTER TABLE whatsapp_core.api_key_ip_allowlists ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.api_key_scopes DROP CONSTRAINT fk_api_key_scopes_key_org;
      ALTER TABLE whatsapp_core.api_key_scopes ADD FOREIGN KEY(api_key_id) REFERENCES whatsapp_core.api_keys(id) ON DELETE CASCADE;
      ALTER TABLE whatsapp_core.developer_webhook_endpoints DROP CONSTRAINT uq_developer_webhook_endpoint_id_org;
      ALTER TABLE whatsapp_core.api_keys DROP CONSTRAINT uq_api_keys_id_org;
    `);
  }
}
