import { MigrationInterface, QueryRunner } from "typeorm";

export class HardenAutomationIntegrity1793265100000 implements MigrationInterface {
  name = "HardenAutomationIntegrity1793265100000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.automation_events
        ADD CONSTRAINT uq_automation_event_id_org UNIQUE(id,organization_id);
      ALTER TABLE whatsapp_core.workflow_executions DROP CONSTRAINT fk_execution_event;
      ALTER TABLE whatsapp_core.workflow_executions
        ADD CONSTRAINT fk_execution_event_tenant FOREIGN KEY(trigger_event_id,organization_id)
        REFERENCES whatsapp_core.automation_events(id,organization_id) ON DELETE RESTRICT;

      CREATE OR REPLACE FUNCTION whatsapp_core.reject_workflow_version_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Published workflow versions are immutable' USING ERRCODE='55000';
      END $$;
      CREATE TRIGGER trg_workflow_versions_immutable
        BEFORE UPDATE OR DELETE ON whatsapp_core.workflow_versions
        FOR EACH ROW EXECUTE FUNCTION whatsapp_core.reject_workflow_version_mutation();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_workflow_versions_immutable ON whatsapp_core.workflow_versions;
      DROP FUNCTION IF EXISTS whatsapp_core.reject_workflow_version_mutation();
      ALTER TABLE whatsapp_core.workflow_executions DROP CONSTRAINT IF EXISTS fk_execution_event_tenant;
      ALTER TABLE whatsapp_core.workflow_executions
        ADD CONSTRAINT fk_execution_event FOREIGN KEY(trigger_event_id)
        REFERENCES whatsapp_core.automation_events(id) ON DELETE RESTRICT;
      ALTER TABLE whatsapp_core.automation_events DROP CONSTRAINT IF EXISTS uq_automation_event_id_org;
    `);
  }
}
