import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUserJourneyEvents1793005800000 implements MigrationInterface {
  name = "CreateUserJourneyEvents1793005800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.user_journey_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        user_id uuid NOT NULL,
        session_id uuid NOT NULL,
        event_type varchar(30) NOT NULL,
        path varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_journey_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_journey_user FOREIGN KEY(user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_journey_event_type CHECK(event_type IN ('PAGE_VIEW','CHECKOUT_STARTED','BILLING_RETURNED','BILLING_CANCELLED')),
        CONSTRAINT ck_journey_path CHECK(path ~ '^/[A-Za-z0-9_./:-]*$')
      );
      CREATE INDEX idx_journey_org_created ON whatsapp_core.user_journey_events(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_journey_user_session_created ON whatsapp_core.user_journey_events(user_id,session_id,created_at DESC);
      ALTER TABLE whatsapp_core.user_journey_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.user_journey_events FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation_user_journey_events ON whatsapp_core.user_journey_events
        USING (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false))
        WITH CHECK (organization_id=nullif(current_setting('app.organization_id',true),'')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin',true),'')::boolean,false));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.user_journey_events`,
    );
  }
}
