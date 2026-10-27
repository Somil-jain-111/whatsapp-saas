import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateEnterpriseControls1793351400000 implements MigrationInterface {
  name = "CreateEnterpriseControls1793351400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      ALTER TABLE whatsapp_core.sessions
        ADD COLUMN mfa_verified_at timestamptz,
        ADD COLUMN auth_method varchar(20) NOT NULL DEFAULT 'PASSWORD',
        ADD CONSTRAINT ck_session_auth_method CHECK(auth_method IN ('PASSWORD','OIDC'));

      CREATE TABLE whatsapp_core.organization_security_policies (
        organization_id uuid PRIMARY KEY,
        require_mfa boolean NOT NULL DEFAULT false,
        session_lifetime_minutes integer NOT NULL DEFAULT 10080,
        idle_timeout_minutes integer NOT NULL DEFAULT 60,
        password_login_enabled boolean NOT NULL DEFAULT true,
        support_access_enabled boolean NOT NULL DEFAULT false,
        updated_by_user_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_security_policy_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_security_policy_user FOREIGN KEY(updated_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_security_session_lifetime CHECK(session_lifetime_minutes BETWEEN 15 AND 43200),
        CONSTRAINT ck_security_idle_timeout CHECK(idle_timeout_minutes BETWEEN 5 AND 1440 AND idle_timeout_minutes <= session_lifetime_minutes)
      );

      CREATE TABLE whatsapp_core.enterprise_sso_connections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        name varchar(100) NOT NULL, provider varchar(30) NOT NULL DEFAULT 'OIDC',
        issuer_url varchar(2048) NOT NULL, client_id varchar(255) NOT NULL, redirect_uri varchar(2048) NOT NULL,
        allowed_domains jsonb NOT NULL DEFAULT '[]'::jsonb,
        client_secret_ciphertext bytea NOT NULL, client_secret_nonce bytea NOT NULL, client_secret_auth_tag bytea NOT NULL,
        key_version varchar(50) NOT NULL, enabled boolean NOT NULL DEFAULT false,
        last_tested_at timestamptz, last_test_status varchar(20), last_test_error varchar(500),
        created_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_sso_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_sso_creator FOREIGN KEY(created_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_sso_id_org UNIQUE(id,organization_id), CONSTRAINT uq_sso_org_name UNIQUE(organization_id,name),
        CONSTRAINT ck_sso_provider CHECK(provider='OIDC'),
        CONSTRAINT ck_sso_issuer_https CHECK(issuer_url ~ '^https://'),
        CONSTRAINT ck_sso_redirect_https CHECK(redirect_uri ~ '^https://'),
        CONSTRAINT ck_sso_domains CHECK(jsonb_typeof(allowed_domains)='array' AND jsonb_array_length(allowed_domains) BETWEEN 1 AND 100),
        CONSTRAINT ck_sso_secret_nonce CHECK(octet_length(client_secret_nonce)=12),
        CONSTRAINT ck_sso_secret_tag CHECK(octet_length(client_secret_auth_tag)=16),
        CONSTRAINT ck_sso_test_status CHECK(last_test_status IS NULL OR last_test_status IN ('SUCCESS','FAILED'))
      );
      CREATE INDEX idx_sso_org_enabled ON whatsapp_core.enterprise_sso_connections(organization_id,enabled);

      CREATE TABLE whatsapp_core.privacy_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        request_type varchar(30) NOT NULL, subject_type varchar(20) NOT NULL, subject_id uuid NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'SUBMITTED', jurisdiction varchar(20) NOT NULL,
        requester_user_id uuid NOT NULL, identity_verified_at timestamptz NOT NULL,
        due_at timestamptz NOT NULL, assigned_platform_admin_id uuid,
        decision_reason varchar(1000), completed_at timestamptz, legal_hold boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_privacy_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_privacy_requester FOREIGN KEY(requester_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_privacy_admin FOREIGN KEY(assigned_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT uq_privacy_id_org UNIQUE(id,organization_id),
        CONSTRAINT ck_privacy_type CHECK(request_type IN ('ACCESS','EXPORT','CORRECTION','DELETION','CONSENT_WITHDRAWAL','RESTRICTION')),
        CONSTRAINT ck_privacy_subject CHECK(subject_type IN ('USER','CONTACT')),
        CONSTRAINT ck_privacy_status CHECK(status IN ('SUBMITTED','IDENTITY_VERIFIED','IN_REVIEW','APPROVED','REJECTED','PROCESSING','COMPLETED','CANCELLED')),
        CONSTRAINT ck_privacy_jurisdiction CHECK(jurisdiction IN ('GDPR','UK_GDPR','DPDP','CCPA','LGPD','OTHER')),
        CONSTRAINT ck_privacy_due CHECK(due_at>created_at),
        CONSTRAINT ck_privacy_complete CHECK(status<>'COMPLETED' OR completed_at IS NOT NULL)
      );
      CREATE INDEX idx_privacy_org_created ON whatsapp_core.privacy_requests(organization_id,created_at DESC,id DESC);
      CREATE INDEX idx_privacy_status_due ON whatsapp_core.privacy_requests(status,due_at) WHERE status NOT IN ('COMPLETED','REJECTED','CANCELLED');

      CREATE TABLE whatsapp_core.privacy_request_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, privacy_request_id uuid NOT NULL,
        actor_user_id uuid, actor_platform_admin_id uuid, event_type varchar(50) NOT NULL,
        from_status varchar(30), to_status varchar(30), note varchar(1000), created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_privacy_event_request FOREIGN KEY(privacy_request_id,organization_id) REFERENCES whatsapp_core.privacy_requests(id,organization_id) ON DELETE CASCADE,
        CONSTRAINT fk_privacy_event_user FOREIGN KEY(actor_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_privacy_event_admin FOREIGN KEY(actor_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT ck_privacy_event_actor CHECK(num_nonnulls(actor_user_id,actor_platform_admin_id)=1),
        CONSTRAINT ck_privacy_event_name CHECK(length(btrim(event_type)) BETWEEN 1 AND 50)
      );
      CREATE INDEX idx_privacy_events_request ON whatsapp_core.privacy_request_events(organization_id,privacy_request_id,created_at,id);

      CREATE TABLE whatsapp_core.data_retention_policies (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
        data_category varchar(40) NOT NULL, retention_days integer NOT NULL,
        legal_basis varchar(500) NOT NULL, deletion_method varchar(20) NOT NULL,
        legal_hold boolean NOT NULL DEFAULT false, effective_at timestamptz NOT NULL DEFAULT now(),
        updated_by_user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_retention_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_retention_user FOREIGN KEY(updated_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_retention_id_org UNIQUE(id,organization_id), CONSTRAINT uq_retention_org_category UNIQUE(organization_id,data_category),
        CONSTRAINT ck_retention_category CHECK(data_category IN ('CONTACTS','MESSAGE_CONTENT','MESSAGE_STATUS','CAMPAIGNS','API_REQUEST_LOGS','SECURITY_LOGS','AUDIT_LOGS','REPORT_EXPORTS','WEBHOOK_PAYLOADS','TEMPORARY_UPLOADS','SESSIONS')),
        CONSTRAINT ck_retention_days CHECK(retention_days BETWEEN 1 AND 3650),
        CONSTRAINT ck_retention_method CHECK(deletion_method IN ('DELETE','ANONYMIZE')),
        CONSTRAINT ck_retention_basis CHECK(length(btrim(legal_basis)) BETWEEN 3 AND 500)
      );
      CREATE INDEX idx_retention_org_effective ON whatsapp_core.data_retention_policies(organization_id,effective_at DESC);

      CREATE TABLE whatsapp_core.data_deletion_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, policy_id uuid NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'PENDING', cutoff_at timestamptz NOT NULL,
        rows_processed integer NOT NULL DEFAULT 0, last_cursor varchar(255), error_code varchar(100),
        started_at timestamptz, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_deletion_policy FOREIGN KEY(policy_id,organization_id) REFERENCES whatsapp_core.data_retention_policies(id,organization_id) ON DELETE RESTRICT,
        CONSTRAINT ck_deletion_status CHECK(status IN ('PENDING','RUNNING','COMPLETED','FAILED','CANCELLED')),
        CONSTRAINT ck_deletion_rows CHECK(rows_processed>=0),
        CONSTRAINT ck_deletion_complete CHECK(status<>'COMPLETED' OR completed_at IS NOT NULL)
      );
      CREATE INDEX idx_deletion_org_created ON whatsapp_core.data_deletion_jobs(organization_id,created_at DESC);
      CREATE INDEX idx_deletion_pending ON whatsapp_core.data_deletion_jobs(status,created_at) WHERE status IN ('PENDING','FAILED');

      CREATE TABLE whatsapp_core.data_residency_assignments (
        organization_id uuid PRIMARY KEY, requested_region varchar(20) NOT NULL, actual_region varchar(20) NOT NULL DEFAULT 'GLOBAL',
        status varchar(20) NOT NULL DEFAULT 'ASSIGNED', transfer_restricted boolean NOT NULL DEFAULT false,
        verified_at timestamptz, verification_reference varchar(255), updated_by_platform_admin_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_residency_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_residency_admin FOREIGN KEY(updated_by_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT ck_residency_requested CHECK(requested_region IN ('GLOBAL','EU','UK','IN','US','BR','APAC')),
        CONSTRAINT ck_residency_actual CHECK(actual_region IN ('GLOBAL','EU','UK','IN','US','BR','APAC')),
        CONSTRAINT ck_residency_status CHECK(status IN ('ASSIGNED','MIGRATION_REQUESTED','MIGRATING','VERIFIED','FAILED')),
        CONSTRAINT ck_residency_verified CHECK(status<>'VERIFIED' OR (verified_at IS NOT NULL AND verification_reference IS NOT NULL))
      );
      CREATE INDEX idx_residency_region_status ON whatsapp_core.data_residency_assignments(actual_region,status);

      CREATE TABLE whatsapp_core.security_incidents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid,
        title varchar(200) NOT NULL, severity varchar(20) NOT NULL, status varchar(20) NOT NULL DEFAULT 'OPEN',
        category varchar(50) NOT NULL, summary varchar(2000) NOT NULL, detected_at timestamptz NOT NULL,
        assigned_platform_admin_id uuid, resolved_at timestamptz, created_by_platform_admin_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_incident_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_incident_assignee FOREIGN KEY(assigned_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT fk_incident_creator FOREIGN KEY(created_by_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT ck_incident_severity CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
        CONSTRAINT ck_incident_status CHECK(status IN ('OPEN','INVESTIGATING','CONTAINED','RESOLVED','CLOSED')),
        CONSTRAINT ck_incident_resolved CHECK(status NOT IN ('RESOLVED','CLOSED') OR resolved_at IS NOT NULL)
      );
      CREATE INDEX idx_incident_status_severity ON whatsapp_core.security_incidents(status,severity,detected_at DESC);

      CREATE TABLE whatsapp_core.security_incident_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_id uuid NOT NULL,
        actor_platform_admin_id uuid NOT NULL, event_type varchar(50) NOT NULL, note varchar(2000),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_incident_event_incident FOREIGN KEY(incident_id) REFERENCES whatsapp_core.security_incidents(id) ON DELETE CASCADE,
        CONSTRAINT fk_incident_event_admin FOREIGN KEY(actor_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT
      );
      CREATE INDEX idx_incident_events_incident ON whatsapp_core.security_incident_events(incident_id,created_at,id);

      CREATE TABLE whatsapp_core.support_access_grants (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, platform_admin_id uuid NOT NULL,
        approved_by_user_id uuid NOT NULL, ticket_reference varchar(100) NOT NULL, purpose varchar(500) NOT NULL,
        scopes jsonb NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_support_org FOREIGN KEY(organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_support_admin FOREIGN KEY(platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT fk_support_approver FOREIGN KEY(approved_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_support_ticket CHECK(length(btrim(ticket_reference)) BETWEEN 3 AND 100),
        CONSTRAINT ck_support_purpose CHECK(length(btrim(purpose)) BETWEEN 3 AND 500),
        CONSTRAINT ck_support_scopes CHECK(jsonb_typeof(scopes)='array' AND jsonb_array_length(scopes) BETWEEN 1 AND 20),
        CONSTRAINT ck_support_expiry CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),
        CONSTRAINT ck_support_revoke CHECK(revoked_at IS NULL OR revoked_at>=created_at)
      );
      CREATE INDEX idx_support_org_active ON whatsapp_core.support_access_grants(organization_id,expires_at) WHERE revoked_at IS NULL;

      CREATE TABLE whatsapp_core.backup_verification_records (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region varchar(20) NOT NULL, backup_reference varchar(255) NOT NULL,
        backup_type varchar(20) NOT NULL, status varchar(20) NOT NULL, started_at timestamptz NOT NULL,
        completed_at timestamptz, restore_point_at timestamptz, evidence_reference varchar(500),
        verified_by_platform_admin_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_backup_admin FOREIGN KEY(verified_by_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT uq_backup_reference UNIQUE(region,backup_reference),
        CONSTRAINT ck_backup_region CHECK(region IN ('GLOBAL','EU','UK','IN','US','BR','APAC')),
        CONSTRAINT ck_backup_type CHECK(backup_type IN ('FULL','PITR','OBJECT_STORAGE','SECRETS')),
        CONSTRAINT ck_backup_status CHECK(status IN ('STARTED','PASSED','FAILED')),
        CONSTRAINT ck_backup_complete CHECK(status='STARTED' OR completed_at IS NOT NULL)
      );
      CREATE INDEX idx_backup_region_created ON whatsapp_core.backup_verification_records(region,created_at DESC);

      INSERT INTO whatsapp_core.organization_security_policies(organization_id,updated_by_user_id)
      SELECT o.id,m.user_id FROM whatsapp_core.organizations o
      JOIN LATERAL (SELECT user_id FROM whatsapp_core.organization_members WHERE organization_id=o.id AND status='ACTIVE' ORDER BY created_at LIMIT 1) m ON true
      ON CONFLICT DO NOTHING;
      INSERT INTO whatsapp_core.data_residency_assignments(organization_id,requested_region,actual_region)
      SELECT id,data_region,'GLOBAL' FROM whatsapp_core.organizations ON CONFLICT DO NOTHING;
      INSERT INTO whatsapp_core.data_retention_policies(organization_id,data_category,retention_days,legal_basis,deletion_method,updated_by_user_id)
      SELECT o.id,v.category,v.days,'Default operational retention; legal review required',v.method,m.user_id
      FROM whatsapp_core.organizations o
      JOIN LATERAL (SELECT user_id FROM whatsapp_core.organization_members WHERE organization_id=o.id AND status='ACTIVE' ORDER BY created_at LIMIT 1) m ON true
      CROSS JOIN (VALUES ('MESSAGE_CONTENT',1095,'DELETE'),('API_REQUEST_LOGS',90,'DELETE'),('SECURITY_LOGS',365,'ANONYMIZE'),('SESSIONS',30,'DELETE')) v(category,days,method)
      ON CONFLICT DO NOTHING;

      INSERT INTO whatsapp_core.permissions(code,name,description) VALUES
        ('enterprise.security.read','Read enterprise security settings','Read tenant security policy, sessions and SSO'),
        ('enterprise.security.manage','Manage enterprise security settings','Manage MFA, sessions and SSO'),
        ('privacy.requests.read','Read privacy requests','Read tenant privacy requests'),
        ('privacy.requests.manage','Manage privacy requests','Create and manage privacy requests'),
        ('retention.read','Read retention policies','Read retention and deletion status'),
        ('retention.manage','Manage retention policies','Change retention with legal-hold safeguards')
      ON CONFLICT(code) DO NOTHING;
      INSERT INTO whatsapp_core.role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM whatsapp_core.roles r CROSS JOIN whatsapp_core.permissions p
      WHERE r.code IN ('owner','admin') AND p.code IN ('enterprise.security.read','enterprise.security.manage','privacy.requests.read','privacy.requests.manage','retention.read','retention.manage')
      ON CONFLICT DO NOTHING;

      DO $$ DECLARE t text; BEGIN
        FOREACH t IN ARRAY ARRAY['organization_security_policies','enterprise_sso_connections','privacy_requests','privacy_request_events','data_retention_policies','data_deletion_jobs','data_residency_assignments','support_access_grants'] LOOP
          EXECUTE format('ALTER TABLE whatsapp_core.%I ENABLE ROW LEVEL SECURITY',t);
          EXECUTE format('ALTER TABLE whatsapp_core.%I FORCE ROW LEVEL SECURITY',t);
          EXECUTE format('CREATE POLICY %I ON whatsapp_core.%I USING (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid OR current_setting(''app.is_platform_admin'',true)=''true'') WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'',true),'''')::uuid OR current_setting(''app.is_platform_admin'',true)=''true'')','pl_'||t,t);
        END LOOP;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") return;
    await queryRunner.query(`
      DROP TABLE IF EXISTS whatsapp_core.backup_verification_records,whatsapp_core.support_access_grants,
        whatsapp_core.security_incident_events,whatsapp_core.security_incidents,whatsapp_core.data_deletion_jobs,
        whatsapp_core.data_retention_policies,whatsapp_core.privacy_request_events,whatsapp_core.privacy_requests,
        whatsapp_core.enterprise_sso_connections,whatsapp_core.organization_security_policies,
        whatsapp_core.data_residency_assignments CASCADE;
      ALTER TABLE whatsapp_core.sessions DROP CONSTRAINT IF EXISTS ck_session_auth_method;
      ALTER TABLE whatsapp_core.sessions DROP COLUMN IF EXISTS mfa_verified_at,DROP COLUMN IF EXISTS auth_method;
      DELETE FROM whatsapp_core.permissions WHERE code IN ('enterprise.security.read','enterprise.security.manage','privacy.requests.read','privacy.requests.manage','retention.read','retention.manage');
    `);
  }
}
