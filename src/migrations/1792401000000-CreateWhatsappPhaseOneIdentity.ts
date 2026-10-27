import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWhatsappPhaseOneIdentity1792401000000 implements MigrationInterface {
  name = "CreateWhatsappPhaseOneIdentity1792401000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== "postgres") {
      throw new Error("WhatsApp Phase 1 requires PostgreSQL");
    }

    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE SCHEMA IF NOT EXISTS whatsapp_core;

      CREATE TABLE whatsapp_core.iso_countries (
        code char(2) PRIMARY KEY,
        name varchar(100) NOT NULL,
        CONSTRAINT ck_wa_country_code_upper CHECK (code ~ '^[A-Z]{2}$'),
        CONSTRAINT ck_wa_country_name_not_blank CHECK (length(btrim(name)) > 0)
      );

      CREATE TABLE whatsapp_core.iso_currencies (
        code char(3) PRIMARY KEY,
        name varchar(100) NOT NULL,
        minor_units smallint NOT NULL,
        CONSTRAINT ck_wa_currency_code_upper CHECK (code ~ '^[A-Z]{3}$'),
        CONSTRAINT ck_wa_currency_minor_units CHECK (minor_units BETWEEN 0 AND 4),
        CONSTRAINT ck_wa_currency_name_not_blank CHECK (length(btrim(name)) > 0)
      );

      CREATE TABLE whatsapp_core.users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email_normalized varchar(254) NOT NULL,
        email_display varchar(254) NOT NULL,
        full_name varchar(150) NOT NULL,
        phone_e164 varchar(16),
        phone_country_code char(2),
        phone_verified_at timestamptz,
        password_hash varchar(255),
        status varchar(30) NOT NULL DEFAULT 'PENDING_VERIFICATION',
        email_verified_at timestamptz,
        last_login_at timestamptz,
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_wa_users_email_normalized UNIQUE (email_normalized),
        CONSTRAINT fk_wa_users_phone_country FOREIGN KEY (phone_country_code) REFERENCES whatsapp_core.iso_countries(code) ON DELETE RESTRICT,
        CONSTRAINT ck_wa_users_email_normalized CHECK (email_normalized = lower(btrim(email_normalized)) AND length(email_normalized) BETWEEN 3 AND 254),
        CONSTRAINT ck_wa_users_email_display CHECK (length(btrim(email_display)) BETWEEN 3 AND 254),
        CONSTRAINT ck_wa_users_name CHECK (length(btrim(full_name)) BETWEEN 1 AND 150),
        CONSTRAINT ck_wa_users_phone CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$'),
        CONSTRAINT ck_wa_users_phone_country_pair CHECK ((phone_e164 IS NULL) = (phone_country_code IS NULL)),
        CONSTRAINT ck_wa_users_status CHECK (status IN ('PENDING_VERIFICATION','ACTIVE','SUSPENDED','DEACTIVATED','DELETED')),
        CONSTRAINT ck_wa_users_deleted CHECK (status <> 'DELETED' OR deleted_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_users_status_created ON whatsapp_core.users(status, created_at DESC);

      CREATE TABLE whatsapp_core.organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(200) NOT NULL,
        slug varchar(100) NOT NULL,
        country_code char(2) NOT NULL,
        currency_code char(3) NOT NULL,
        timezone varchar(64) NOT NULL,
        data_region varchar(30) NOT NULL DEFAULT 'GLOBAL',
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_wa_organizations_slug UNIQUE (slug),
        CONSTRAINT fk_wa_organizations_country FOREIGN KEY (country_code) REFERENCES whatsapp_core.iso_countries(code) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_organizations_currency FOREIGN KEY (currency_code) REFERENCES whatsapp_core.iso_currencies(code) ON DELETE RESTRICT,
        CONSTRAINT ck_wa_organizations_name CHECK (length(btrim(name)) BETWEEN 1 AND 200),
        CONSTRAINT ck_wa_organizations_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
        CONSTRAINT ck_wa_organizations_timezone CHECK (length(btrim(timezone)) BETWEEN 1 AND 64),
        CONSTRAINT ck_wa_organizations_region CHECK (data_region IN ('GLOBAL','EU','UK','IN','US','BR','APAC')),
        CONSTRAINT ck_wa_organizations_status CHECK (status IN ('ACTIVE','SUSPENDED','DEACTIVATED','DELETED')),
        CONSTRAINT ck_wa_organizations_deleted CHECK (status <> 'DELETED' OR deleted_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_organizations_status_created ON whatsapp_core.organizations(status, created_at DESC);

      CREATE TABLE whatsapp_core.roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid,
        name varchar(50) NOT NULL,
        code varchar(100) NOT NULL,
        scope varchar(30) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_roles_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_roles_id_org UNIQUE NULLS NOT DISTINCT (id, organization_id),
        CONSTRAINT ck_wa_roles_name CHECK (length(btrim(name)) BETWEEN 1 AND 50),
        CONSTRAINT ck_wa_roles_code CHECK (code ~ '^[a-z][a-z0-9_.-]{1,99}$'),
        CONSTRAINT ck_wa_roles_scope CHECK (scope IN ('ORGANIZATION','PLATFORM')),
        CONSTRAINT ck_wa_roles_status CHECK (status IN ('ACTIVE','INACTIVE')),
        CONSTRAINT ck_wa_roles_ownership CHECK (NOT (scope = 'PLATFORM' AND organization_id IS NOT NULL))
      );
      CREATE UNIQUE INDEX uq_wa_roles_global_code ON whatsapp_core.roles(code) WHERE organization_id IS NULL;
      CREATE UNIQUE INDEX uq_wa_roles_org_code ON whatsapp_core.roles(organization_id, code) WHERE organization_id IS NOT NULL;
      CREATE INDEX idx_wa_roles_org_status ON whatsapp_core.roles(organization_id, status);

      CREATE TABLE whatsapp_core.permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code varchar(100) NOT NULL,
        name varchar(150) NOT NULL,
        description varchar(500),
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_wa_permissions_code UNIQUE (code),
        CONSTRAINT ck_wa_permissions_code CHECK (code ~ '^[a-z][a-z0-9_.:-]{1,99}$'),
        CONSTRAINT ck_wa_permissions_name CHECK (length(btrim(name)) BETWEEN 1 AND 150),
        CONSTRAINT ck_wa_permissions_status CHECK (status IN ('ACTIVE','INACTIVE'))
      );

      CREATE TABLE whatsapp_core.role_permissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_role_permissions_role FOREIGN KEY (role_id) REFERENCES whatsapp_core.roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_wa_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES whatsapp_core.permissions(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_role_permissions_pair UNIQUE (role_id, permission_id)
      );
      CREATE INDEX idx_wa_role_permissions_permission ON whatsapp_core.role_permissions(permission_id, role_id);

      CREATE TABLE whatsapp_core.organization_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        invited_by_user_id uuid,
        joined_at timestamptz NOT NULL DEFAULT now(),
        suspended_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_members_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_members_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_members_role FOREIGN KEY (role_id) REFERENCES whatsapp_core.roles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_members_inviter FOREIGN KEY (invited_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE SET NULL,
        CONSTRAINT uq_wa_members_org_user UNIQUE (organization_id, user_id),
        CONSTRAINT ck_wa_members_status CHECK (status IN ('ACTIVE','SUSPENDED','LEFT')),
        CONSTRAINT ck_wa_members_suspension CHECK (status <> 'SUSPENDED' OR suspended_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_members_org_status ON whatsapp_core.organization_members(organization_id, status);
      CREATE INDEX idx_wa_members_user_status ON whatsapp_core.organization_members(user_id, status);
      CREATE INDEX idx_wa_members_role ON whatsapp_core.organization_members(role_id);

      CREATE TABLE whatsapp_core.invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        email_normalized varchar(254) NOT NULL,
        role_id uuid NOT NULL,
        token_hash char(64) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'PENDING',
        invited_by_user_id uuid NOT NULL,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_invitations_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE CASCADE,
        CONSTRAINT fk_wa_invitations_role FOREIGN KEY (role_id) REFERENCES whatsapp_core.roles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_invitations_inviter FOREIGN KEY (invited_by_user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT uq_wa_invitations_token_hash UNIQUE (token_hash),
        CONSTRAINT ck_wa_invitations_email CHECK (email_normalized = lower(btrim(email_normalized)) AND length(email_normalized) BETWEEN 3 AND 254),
        CONSTRAINT ck_wa_invitations_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_wa_invitations_status CHECK (status IN ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
        CONSTRAINT ck_wa_invitations_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_wa_invitations_acceptance CHECK ((status = 'ACCEPTED') = (accepted_at IS NOT NULL))
      );
      CREATE UNIQUE INDEX uq_wa_invitations_pending_email ON whatsapp_core.invitations(organization_id, email_normalized) WHERE status = 'PENDING';
      CREATE INDEX idx_wa_invitations_org_status_expires ON whatsapp_core.invitations(organization_id, status, expires_at);

      CREATE TABLE whatsapp_core.sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        token_hash char(64) NOT NULL,
        ip_address inet,
        user_agent varchar(1024),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        revocation_reason varchar(100),
        last_seen_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_sessions_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_sessions_token_hash UNIQUE (token_hash),
        CONSTRAINT ck_wa_sessions_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_wa_sessions_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_wa_sessions_revocation CHECK ((revoked_at IS NULL AND revocation_reason IS NULL) OR revoked_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_sessions_user_active ON whatsapp_core.sessions(user_id, expires_at DESC) WHERE revoked_at IS NULL;
      CREATE INDEX idx_wa_sessions_expiry ON whatsapp_core.sessions(expires_at);

      CREATE TABLE whatsapp_core.email_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_email_verifications_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_email_verifications_token UNIQUE (token_hash),
        CONSTRAINT ck_wa_email_verifications_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_wa_email_verifications_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_wa_email_verifications_consumed CHECK (consumed_at IS NULL OR consumed_at >= created_at)
      );
      CREATE INDEX idx_wa_email_verifications_user_created ON whatsapp_core.email_verifications(user_id, created_at DESC);
      CREATE INDEX idx_wa_email_verifications_expiry ON whatsapp_core.email_verifications(expires_at) WHERE consumed_at IS NULL;

      CREATE TABLE whatsapp_core.password_resets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_password_resets_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_password_resets_token UNIQUE (token_hash),
        CONSTRAINT ck_wa_password_resets_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_wa_password_resets_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_wa_password_resets_consumed CHECK (consumed_at IS NULL OR consumed_at >= created_at)
      );
      CREATE INDEX idx_wa_password_resets_user_created ON whatsapp_core.password_resets(user_id, created_at DESC);
      CREATE INDEX idx_wa_password_resets_expiry ON whatsapp_core.password_resets(expires_at) WHERE consumed_at IS NULL;

      CREATE TABLE whatsapp_core.platform_admins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        role varchar(30) NOT NULL,
        status varchar(30) NOT NULL DEFAULT 'ACTIVE',
        granted_by_admin_id uuid,
        granted_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_platform_admins_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_platform_admins_grantor FOREIGN KEY (granted_by_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE RESTRICT,
        CONSTRAINT uq_wa_platform_admins_user UNIQUE (user_id),
        CONSTRAINT ck_wa_platform_admins_role CHECK (role IN ('SUPER_ADMIN','SECURITY_ADMIN','SUPPORT_READONLY','AUDITOR')),
        CONSTRAINT ck_wa_platform_admins_status CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
        CONSTRAINT ck_wa_platform_admins_revocation CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_platform_admins_status ON whatsapp_core.platform_admins(status);

      CREATE TABLE whatsapp_core.user_mfa_factors (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
        type varchar(30) NOT NULL, name varchar(100) NOT NULL,
        secret_ciphertext bytea NOT NULL, secret_nonce bytea NOT NULL, secret_auth_tag bytea NOT NULL,
        key_version varchar(50) NOT NULL, status varchar(30) NOT NULL DEFAULT 'PENDING',
        verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_mfa_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE CASCADE,
        CONSTRAINT uq_wa_mfa_user_name UNIQUE (user_id, name),
        CONSTRAINT ck_wa_mfa_type CHECK (type IN ('TOTP','WEBAUTHN')),
        CONSTRAINT ck_wa_mfa_name CHECK (length(btrim(name)) BETWEEN 1 AND 100),
        CONSTRAINT ck_wa_mfa_nonce CHECK (octet_length(secret_nonce) = 12),
        CONSTRAINT ck_wa_mfa_tag CHECK (octet_length(secret_auth_tag) = 16),
        CONSTRAINT ck_wa_mfa_status CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
        CONSTRAINT ck_wa_mfa_verified CHECK (status <> 'ACTIVE' OR verified_at IS NOT NULL)
      );
      CREATE INDEX idx_wa_mfa_user_status ON whatsapp_core.user_mfa_factors(user_id, status);

      CREATE TABLE whatsapp_core.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid,
        actor_user_id uuid, actor_platform_admin_id uuid, action varchar(100) NOT NULL,
        resource_type varchar(100) NOT NULL, resource_id uuid, ip_address inet,
        request_id varchar(100), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_audit_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_wa_audit_actor_user FOREIGN KEY (actor_user_id) REFERENCES whatsapp_core.users(id) ON DELETE SET NULL,
        CONSTRAINT fk_wa_audit_actor_admin FOREIGN KEY (actor_platform_admin_id) REFERENCES whatsapp_core.platform_admins(id) ON DELETE SET NULL,
        CONSTRAINT ck_wa_audit_action CHECK (length(btrim(action)) BETWEEN 1 AND 100),
        CONSTRAINT ck_wa_audit_resource CHECK (length(btrim(resource_type)) BETWEEN 1 AND 100),
        CONSTRAINT ck_wa_audit_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768)
      );
      CREATE INDEX idx_wa_audit_org_created_id ON whatsapp_core.audit_logs(organization_id, created_at DESC, id DESC);
      CREATE INDEX idx_wa_audit_actor_created ON whatsapp_core.audit_logs(actor_user_id, created_at DESC);
      CREATE INDEX idx_wa_audit_request ON whatsapp_core.audit_logs(request_id) WHERE request_id IS NOT NULL;

      CREATE TABLE whatsapp_core.security_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id uuid,
        event_type varchar(100) NOT NULL, severity varchar(20) NOT NULL, ip_address inet,
        request_id varchar(100), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_wa_security_org FOREIGN KEY (organization_id) REFERENCES whatsapp_core.organizations(id) ON DELETE SET NULL,
        CONSTRAINT fk_wa_security_user FOREIGN KEY (user_id) REFERENCES whatsapp_core.users(id) ON DELETE SET NULL,
        CONSTRAINT ck_wa_security_type CHECK (length(btrim(event_type)) BETWEEN 1 AND 100),
        CONSTRAINT ck_wa_security_severity CHECK (severity IN ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
        CONSTRAINT ck_wa_security_metadata CHECK (jsonb_typeof(metadata) = 'object' AND octet_length(metadata::text) <= 32768)
      );
      CREATE INDEX idx_wa_security_org_created ON whatsapp_core.security_events(organization_id, created_at DESC);
      CREATE INDEX idx_wa_security_user_created ON whatsapp_core.security_events(user_id, created_at DESC);
      CREATE INDEX idx_wa_security_severity_created ON whatsapp_core.security_events(severity, created_at DESC);

      CREATE OR REPLACE FUNCTION whatsapp_core.assert_assignable_role() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE role_org uuid; role_scope varchar(30); role_status varchar(30);
      BEGIN
        SELECT organization_id, scope, status INTO role_org, role_scope, role_status
        FROM whatsapp_core.roles WHERE id = NEW.role_id FOR SHARE;
        IF NOT FOUND OR role_scope <> 'ORGANIZATION' OR role_status <> 'ACTIVE' THEN
          RAISE EXCEPTION 'role is not an active organization role' USING ERRCODE = '23514';
        END IF;
        IF role_org IS NOT NULL AND role_org <> NEW.organization_id THEN
          RAISE EXCEPTION 'cross-tenant role assignment is forbidden' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_wa_member_role_tenant BEFORE INSERT OR UPDATE OF organization_id, role_id ON whatsapp_core.organization_members
        FOR EACH ROW EXECUTE FUNCTION whatsapp_core.assert_assignable_role();
      CREATE TRIGGER trg_wa_invitation_role_tenant BEFORE INSERT OR UPDATE OF organization_id, role_id ON whatsapp_core.invitations
        FOR EACH ROW EXECUTE FUNCTION whatsapp_core.assert_assignable_role();

      CREATE OR REPLACE FUNCTION whatsapp_core.assert_organization_has_owner() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_org uuid; owner_count bigint;
      BEGIN
        IF TG_TABLE_NAME = 'organizations' THEN target_org := NEW.id;
        ELSE target_org := OLD.organization_id;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 0));
        SELECT count(*) INTO owner_count
        FROM whatsapp_core.organization_members m JOIN whatsapp_core.roles r ON r.id = m.role_id
        WHERE m.organization_id = target_org AND m.status = 'ACTIVE' AND r.code = 'owner';
        IF owner_count = 0 THEN RAISE EXCEPTION 'organization must retain an active owner' USING ERRCODE = '23514'; END IF;
        RETURN COALESCE(NEW, OLD);
      END $$;
      CREATE CONSTRAINT TRIGGER trg_wa_org_requires_owner AFTER INSERT ON whatsapp_core.organizations
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION whatsapp_core.assert_organization_has_owner();
      CREATE CONSTRAINT TRIGGER trg_wa_last_owner AFTER DELETE OR UPDATE OF status, role_id, organization_id ON whatsapp_core.organization_members
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION whatsapp_core.assert_organization_has_owner();

      CREATE OR REPLACE FUNCTION whatsapp_core.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'audit logs are append-only' USING ERRCODE = '55000'; END $$;
      CREATE TRIGGER trg_wa_audit_immutable BEFORE UPDATE OR DELETE ON whatsapp_core.audit_logs
        FOR EACH ROW EXECUTE FUNCTION whatsapp_core.reject_audit_mutation();

      ALTER TABLE whatsapp_core.organizations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.organization_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.roles ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.invitations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.audit_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.security_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.organizations FORCE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.organization_members FORCE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.roles FORCE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.invitations FORCE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.audit_logs FORCE ROW LEVEL SECURITY;
      ALTER TABLE whatsapp_core.security_events FORCE ROW LEVEL SECURITY;

      CREATE POLICY wa_org_isolation ON whatsapp_core.organizations USING (
        id = nullif(current_setting('app.organization_id', true), '')::uuid OR
        coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
      CREATE POLICY wa_member_isolation ON whatsapp_core.organization_members USING (
        organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
      CREATE POLICY wa_role_isolation ON whatsapp_core.roles USING (
        organization_id IS NULL OR organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR (organization_id IS NULL AND coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)));
      CREATE POLICY wa_invitation_isolation ON whatsapp_core.invitations USING (
        organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
      CREATE POLICY wa_audit_isolation ON whatsapp_core.audit_logs USING (
        organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
      CREATE POLICY wa_security_isolation ON whatsapp_core.security_events USING (
        organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false)
      ) WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid OR coalesce(nullif(current_setting('app.is_platform_admin', true), '')::boolean, false));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS whatsapp_core CASCADE`);
  }
}
