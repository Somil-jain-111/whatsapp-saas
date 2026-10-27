import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeveloperRetention1793092300000 implements MigrationInterface {
  name = "AddDeveloperRetention1793092300000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.api_request_logs ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days';
      ALTER TABLE whatsapp_core.api_security_events ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '180 days';
      ALTER TABLE whatsapp_core.developer_webhook_deliveries ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days';
      CREATE INDEX idx_api_request_logs_expiry ON whatsapp_core.api_request_logs(expires_at);
      CREATE INDEX idx_api_security_events_expiry ON whatsapp_core.api_security_events(expires_at);
      CREATE INDEX idx_developer_webhook_deliveries_expiry ON whatsapp_core.developer_webhook_deliveries(expires_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.api_request_logs DROP COLUMN IF EXISTS expires_at;
      ALTER TABLE whatsapp_core.api_security_events DROP COLUMN IF EXISTS expires_at;
      ALTER TABLE whatsapp_core.developer_webhook_deliveries DROP COLUMN IF EXISTS expires_at;
    `);
  }
}
