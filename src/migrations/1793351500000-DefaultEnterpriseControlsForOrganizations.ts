import { MigrationInterface, QueryRunner } from "typeorm";

export class DefaultEnterpriseControlsForOrganizations1793351500000
  implements MigrationInterface
{
  name = "DefaultEnterpriseControlsForOrganizations1793351500000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION whatsapp_core.ensure_enterprise_organization_defaults()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE region varchar(20);
      BEGIN
        IF NEW.status <> 'ACTIVE' THEN RETURN NEW; END IF;
        SELECT data_region INTO region FROM whatsapp_core.organizations WHERE id=NEW.organization_id;
        INSERT INTO whatsapp_core.organization_security_policies(organization_id,updated_by_user_id)
        VALUES(NEW.organization_id,NEW.user_id) ON CONFLICT DO NOTHING;
        INSERT INTO whatsapp_core.data_residency_assignments(organization_id,requested_region,actual_region)
        VALUES(NEW.organization_id,region,'GLOBAL') ON CONFLICT DO NOTHING;
        INSERT INTO whatsapp_core.data_retention_policies(
          organization_id,data_category,retention_days,legal_basis,deletion_method,updated_by_user_id
        )
        SELECT NEW.organization_id,v.category,v.days,'Default operational retention; legal review required',v.method,NEW.user_id
        FROM (VALUES ('MESSAGE_CONTENT',1095,'DELETE'),('API_REQUEST_LOGS',90,'DELETE'),
          ('SECURITY_LOGS',365,'ANONYMIZE'),('SESSIONS',30,'DELETE')) v(category,days,method)
        ON CONFLICT DO NOTHING;
        RETURN NEW;
      END $$;

      CREATE TRIGGER trg_enterprise_organization_defaults
      AFTER INSERT OR UPDATE OF status ON whatsapp_core.organization_members
      FOR EACH ROW EXECUTE FUNCTION whatsapp_core.ensure_enterprise_organization_defaults();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_enterprise_organization_defaults ON whatsapp_core.organization_members;
      DROP FUNCTION IF EXISTS whatsapp_core.ensure_enterprise_organization_defaults();
    `);
  }
}
