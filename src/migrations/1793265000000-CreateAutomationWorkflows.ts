import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAutomationWorkflows1793265000000 implements MigrationInterface {
  name = "CreateAutomationWorkflows1793265000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      CREATE TABLE whatsapp_core.workflows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(150) NOT NULL,
        description varchar(1000), status varchar(20) NOT NULL DEFAULT 'DRAFT', revision integer NOT NULL DEFAULT 1,
        published_version integer, trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
        draft_nodes jsonb NOT NULL DEFAULT '[]'::jsonb, draft_edges jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id uuid NOT NULL, updated_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(), archived_at timestamptz, retention_until timestamptz NOT NULL DEFAULT now()+interval '3 years',
        CONSTRAINT uq_workflow_id_org UNIQUE(id,organization_id), CONSTRAINT uq_workflow_name UNIQUE(organization_id,name),
        CONSTRAINT fk_workflow_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_workflow_creator FOREIGN KEY(organization_id,created_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT fk_workflow_updater FOREIGN KEY(organization_id,updated_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_workflow_status CHECK(status IN ('DRAFT','VALIDATING','PUBLISHED','ACTIVE','PAUSED','ARCHIVED')),
        CONSTRAINT ck_workflow_revision CHECK(revision>0 AND (published_version IS NULL OR published_version>0)),
        CONSTRAINT ck_workflow_json CHECK(jsonb_typeof(trigger_config)='object' AND jsonb_typeof(draft_nodes)='array' AND jsonb_typeof(draft_edges)='array' AND octet_length(trigger_config::text)<=16384 AND octet_length(draft_nodes::text)<=262144 AND octet_length(draft_edges::text)<=131072)
      );
      CREATE INDEX idx_workflow_list ON whatsapp_core.workflows(organization_id,status,updated_at DESC,id DESC);

      CREATE TABLE whatsapp_core.workflow_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, workflow_id uuid NOT NULL,
        version integer NOT NULL, trigger_config jsonb NOT NULL, nodes jsonb NOT NULL, edges jsonb NOT NULL,
        checksum char(64) NOT NULL, published_by_user_id uuid NOT NULL, published_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_workflow_version UNIQUE(workflow_id,version), CONSTRAINT uq_workflow_version_id_org UNIQUE(id,organization_id),
        CONSTRAINT fk_workflow_version_parent FOREIGN KEY(workflow_id,organization_id) REFERENCES whatsapp_core.workflows(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_workflow_version_user FOREIGN KEY(organization_id,published_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_workflow_version CHECK(version>0 AND checksum ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_workflow_version_json CHECK(jsonb_typeof(trigger_config)='object' AND jsonb_typeof(nodes)='array' AND jsonb_typeof(edges)='array' AND octet_length(trigger_config::text)<=16384 AND octet_length(nodes::text)<=262144 AND octet_length(edges::text)<=131072)
      );

      CREATE TABLE whatsapp_core.automation_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, external_event_id varchar(255) NOT NULL,
        event_type varchar(60) NOT NULL, source_type varchar(50), source_id varchar(255), payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        payload_ciphertext bytea NOT NULL, payload_nonce bytea NOT NULL, payload_auth_tag bytea NOT NULL, payload_key_version varchar(50) NOT NULL,
        occurred_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
        CONSTRAINT uq_automation_event UNIQUE(organization_id,external_event_id),
        CONSTRAINT fk_automation_event_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT ck_automation_event_payload CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=65536)
      );
      CREATE INDEX idx_automation_event_type ON whatsapp_core.automation_events(organization_id,event_type,occurred_at DESC);

      CREATE TABLE whatsapp_core.workflow_executions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, workflow_id uuid NOT NULL, workflow_version_id uuid NOT NULL,
        trigger_event_id uuid NOT NULL, status varchar(20) NOT NULL DEFAULT 'PENDING', current_node_id varchar(100),
        context jsonb NOT NULL DEFAULT '{}'::jsonb, variables jsonb NOT NULL DEFAULT '{}'::jsonb, step_count integer NOT NULL DEFAULT 0,
        lease_until timestamptz, attempt_count integer NOT NULL DEFAULT 0,
        failure_code varchar(100), failure_reason varchar(500), started_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz, expires_at timestamptz NOT NULL DEFAULT now()+interval '1 year',
        CONSTRAINT uq_execution_id_org UNIQUE(id,organization_id), CONSTRAINT uq_execution_event_workflow UNIQUE(organization_id,workflow_id,trigger_event_id),
        CONSTRAINT fk_execution_workflow FOREIGN KEY(workflow_id,organization_id) REFERENCES whatsapp_core.workflows(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_execution_version FOREIGN KEY(workflow_version_id,organization_id) REFERENCES whatsapp_core.workflow_versions(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT fk_execution_event FOREIGN KEY(trigger_event_id) REFERENCES whatsapp_core.automation_events(id) ON DELETE RESTRICT,
        CONSTRAINT ck_execution_status CHECK(status IN ('PENDING','RUNNING','WAITING','COMPLETED','FAILED','CANCELLED')),
        CONSTRAINT ck_execution_steps CHECK(step_count BETWEEN 0 AND 250 AND attempt_count BETWEEN 0 AND 1000),
        CONSTRAINT ck_execution_json CHECK(jsonb_typeof(context)='object' AND jsonb_typeof(variables)='object' AND octet_length(context::text)<=131072 AND octet_length(variables::text)<=65536)
      );
      CREATE INDEX idx_execution_workflow ON whatsapp_core.workflow_executions(organization_id,workflow_id,updated_at DESC,id DESC);
      CREATE INDEX idx_execution_recovery ON whatsapp_core.workflow_executions(status,updated_at) WHERE status IN ('PENDING','RUNNING','WAITING');

      CREATE TABLE whatsapp_core.workflow_step_executions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, execution_id uuid NOT NULL,
        node_id varchar(100) NOT NULL, node_type varchar(40) NOT NULL, operation_id varchar(255) NOT NULL,
        attempt_count integer NOT NULL DEFAULT 1, status varchar(20) NOT NULL DEFAULT 'RUNNING', input jsonb NOT NULL DEFAULT '{}'::jsonb,
        output jsonb NOT NULL DEFAULT '{}'::jsonb, error_code varchar(100), error_message varchar(500),
        started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        CONSTRAINT uq_step_operation UNIQUE(organization_id,operation_id),
        CONSTRAINT fk_step_execution FOREIGN KEY(execution_id,organization_id) REFERENCES whatsapp_core.workflow_executions(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_step_status CHECK(status IN ('RUNNING','WAITING','COMPLETED','FAILED','SKIPPED')),
        CONSTRAINT ck_step_attempt CHECK(attempt_count BETWEEN 1 AND 3),
        CONSTRAINT ck_step_json CHECK(jsonb_typeof(input)='object' AND jsonb_typeof(output)='object' AND octet_length(input::text)<=65536 AND octet_length(output::text)<=65536)
      );
      CREATE INDEX idx_step_trace ON whatsapp_core.workflow_step_executions(organization_id,execution_id,started_at,id);

      CREATE TABLE whatsapp_core.workflow_wait_states (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, execution_id uuid NOT NULL,
        node_id varchar(100) NOT NULL, resume_at timestamptz NOT NULL, status varchar(20) NOT NULL DEFAULT 'WAITING',
        created_at timestamptz NOT NULL DEFAULT now(), resumed_at timestamptz,
        CONSTRAINT uq_wait_execution_node UNIQUE(execution_id,node_id),
        CONSTRAINT fk_wait_execution FOREIGN KEY(execution_id,organization_id) REFERENCES whatsapp_core.workflow_executions(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT ck_wait_status CHECK(status IN ('WAITING','RESUMED','CANCELLED'))
      );
      CREATE INDEX idx_wait_due ON whatsapp_core.workflow_wait_states(status,resume_at) WHERE status='WAITING';

      CREATE TABLE whatsapp_core.chatbot_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(120) NOT NULL,
        match_type varchar(20) NOT NULL, keywords jsonb NOT NULL DEFAULT '[]'::jsonb, response_type varchar(30) NOT NULL,
        response_config jsonb NOT NULL, priority integer NOT NULL DEFAULT 100, is_fallback boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true, created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_chatbot_rule_id_org UNIQUE(id,organization_id),
        CONSTRAINT fk_chatbot_rule_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_chatbot_rule_user FOREIGN KEY(organization_id,created_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_chatbot_match CHECK(match_type IN ('EXACT','NORMALIZED','CONTAINS')),
        CONSTRAINT ck_chatbot_response CHECK(response_type IN ('SESSION_MESSAGE','TEMPLATE','AGENT_HANDOFF')),
        CONSTRAINT ck_chatbot_priority CHECK(priority BETWEEN 1 AND 10000),
        CONSTRAINT ck_chatbot_json CHECK(jsonb_typeof(keywords)='array' AND jsonb_array_length(keywords)<=50 AND jsonb_typeof(response_config)='object' AND octet_length(response_config::text)<=16384)
      );
      CREATE INDEX idx_chatbot_rules ON whatsapp_core.chatbot_rules(organization_id,active,priority,id);

      CREATE TABLE whatsapp_core.workflow_credentials (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, name varchar(100) NOT NULL,
        header_name varchar(100) NOT NULL, secret_ciphertext bytea NOT NULL, secret_nonce bytea NOT NULL, secret_auth_tag bytea NOT NULL,
        key_version varchar(50) NOT NULL, created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
        CONSTRAINT uq_workflow_credential_id_org UNIQUE(id,organization_id), CONSTRAINT uq_workflow_credential_name UNIQUE(organization_id,name),
        CONSTRAINT fk_workflow_credential_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_workflow_credential_user FOREIGN KEY(organization_id,created_by_user_id) REFERENCES whatsapp_core.organization_members(organization_id,user_id) ON DELETE RESTRICT,
        CONSTRAINT ck_workflow_credential_header CHECK(header_name ~ '^[A-Za-z0-9-]{1,100}$')
      );

      INSERT INTO whatsapp_core.permissions(code,name) VALUES
        ('automations.read','Read workflows and executions'),('automations.write','Create and edit workflow drafts'),
        ('automations.publish','Publish and activate workflows'),('automations.execute','Test, retry and cancel workflows'),
        ('automations.credentials.manage','Manage workflow credentials')
      ON CONFLICT(code) DO UPDATE SET name=excluded.name,status='ACTIVE';
      INSERT INTO whatsapp_core.role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM whatsapp_core.roles r CROSS JOIN whatsapp_core.permissions p
      WHERE r.code IN ('owner','admin','platform.super_admin') AND p.code LIKE 'automations.%' ON CONFLICT DO NOTHING;

      DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['workflows','workflow_versions','automation_events','workflow_executions','workflow_step_executions','workflow_wait_states','chatbot_rules','workflow_credentials'] LOOP
        EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
        EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false)) WITH CHECK (organization_id=nullif(current_setting(''app.organization_id'',true),'''')::uuid OR coalesce(nullif(current_setting(''app.is_platform_admin'',true),'''')::boolean,false))','tenant_isolation_'||t,t);
      END LOOP; END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(
      `DROP TABLE IF EXISTS whatsapp_core.workflow_credentials,whatsapp_core.chatbot_rules,whatsapp_core.workflow_wait_states,whatsapp_core.workflow_step_executions,whatsapp_core.workflow_executions,whatsapp_core.automation_events,whatsapp_core.workflow_versions,whatsapp_core.workflows CASCADE`,
    );
  }
}
