import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTenantMetaAppConfigurations1793437800000
  implements MigrationInterface
{
  name = "AddTenantMetaAppConfigurations1793437800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.meta_app_configurations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        app_id varchar(64) NOT NULL,
        configuration_id varchar(64) NOT NULL,
        graph_api_version varchar(20) NOT NULL,
        webhook_key uuid NOT NULL DEFAULT gen_random_uuid(),
        secret_ciphertext bytea NOT NULL,
        secret_nonce bytea NOT NULL,
        secret_auth_tag bytea NOT NULL,
        key_version varchar(100) NOT NULL,
        created_by_user_id uuid NOT NULL,
        updated_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_meta_app_config_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_meta_app_config_creator FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_meta_app_config_updater FOREIGN KEY(updated_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_meta_app_config_org UNIQUE(organization_id),
        CONSTRAINT uq_meta_app_config_webhook UNIQUE(webhook_key),
        CONSTRAINT ck_meta_app_config_app_id CHECK(app_id ~ '^[0-9]{1,64}$'),
        CONSTRAINT ck_meta_app_config_id CHECK(configuration_id ~ '^[0-9]{1,64}$'),
        CONSTRAINT ck_meta_app_config_version CHECK(graph_api_version ~ '^v[0-9]+\\.[0-9]+$'),
        CONSTRAINT ck_meta_app_config_secret CHECK(octet_length(secret_nonce)=12 AND octet_length(secret_auth_tag)=16)
      );
      CREATE INDEX idx_meta_app_config_org_updated ON whatsapp_core.meta_app_configurations(organization_id,updated_at DESC);
      ALTER TABLE whatsapp_core.meta_app_configurations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.meta_app_configurations FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_meta_app_configurations ON whatsapp_core.meta_app_configurations
        USING (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false))
        WITH CHECK (organization_id = nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.meta_app_configurations`,
    );
  }
}
