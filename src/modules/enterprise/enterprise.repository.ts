import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { TenantContextService } from "../database/tenant-context.service";

@Injectable()
export class EnterpriseRepository {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  policy(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT organization_id,"require_mfa" AS "requireMfa",session_lifetime_minutes AS "sessionLifetimeMinutes",
          idle_timeout_minutes AS "idleTimeoutMinutes",password_login_enabled AS "passwordLoginEnabled",
          support_access_enabled AS "supportAccessEnabled",updated_at AS "updatedAt"
          FROM whatsapp_core.organization_security_policies WHERE organization_id=$1`,
            [org],
          )
        )[0],
    );
  }

  updatePolicy(org: string, user: string, dto: any) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.organization_security_policies SET
          require_mfa=coalesce($3,require_mfa),session_lifetime_minutes=coalesce($4,session_lifetime_minutes),
          idle_timeout_minutes=coalesce($5,idle_timeout_minutes),password_login_enabled=coalesce($6,password_login_enabled),
          support_access_enabled=coalesce($7,support_access_enabled),updated_by_user_id=$2,updated_at=now()
         WHERE organization_id=$1 RETURNING *`,
        [
          org,
          user,
          dto.requireMfa ?? null,
          dto.sessionLifetimeMinutes ?? null,
          dto.idleTimeoutMinutes ?? null,
          dto.passwordLoginEnabled ?? null,
          dto.supportAccessEnabled ?? null,
        ],
      );
      return row;
    });
  }

  membersWithoutMfa(org: string) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `SELECT count(*)::integer count FROM whatsapp_core.organization_members om
         WHERE om.organization_id=$1 AND om.status='ACTIVE' AND NOT EXISTS(
           SELECT 1 FROM whatsapp_core.user_mfa_factors f WHERE f.user_id=om.user_id AND f.status='ACTIVE')`,
        [org],
      );
      return row.count as number;
    });
  }

  sso(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,name,provider,issuer_url AS "issuerUrl",client_id AS "clientId",redirect_uri AS "redirectUri",
         allowed_domains AS "allowedDomains",enabled,last_tested_at AS "lastTestedAt",last_test_status AS "lastTestStatus",
         last_test_error AS "lastTestError",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM whatsapp_core.enterprise_sso_connections WHERE organization_id=$1 ORDER BY created_at DESC`,
        [org],
      ),
    );
  }

  createSso(org: string, user: string, id: string, dto: any, secret: any) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.enterprise_sso_connections(id,organization_id,name,issuer_url,client_id,redirect_uri,
           allowed_domains,client_secret_ciphertext,client_secret_nonce,client_secret_auth_tag,key_version,enabled,created_by_user_id)
           VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)
           RETURNING id,name,provider,issuer_url AS "issuerUrl",client_id AS "clientId",redirect_uri AS "redirectUri",
             allowed_domains AS "allowedDomains",enabled,created_at AS "createdAt"`,
            [
              id,
              org,
              dto.name,
              dto.issuerUrl.replace(/\/$/, ""),
              dto.clientId,
              dto.redirectUri,
              JSON.stringify(dto.allowedDomains),
              secret.ciphertext,
              secret.nonce,
              secret.authTag,
              secret.keyVersion,
              dto.enabled,
              user,
            ],
          )
        )[0],
    );
  }

  updateSso(org: string, id: string, dto: any, secret?: any) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.enterprise_sso_connections SET name=coalesce($3,name),allowed_domains=coalesce($4::jsonb,allowed_domains),
           enabled=coalesce($5,enabled),client_secret_ciphertext=coalesce($6,client_secret_ciphertext),
           client_secret_nonce=coalesce($7,client_secret_nonce),client_secret_auth_tag=coalesce($8,client_secret_auth_tag),
           key_version=coalesce($9,key_version),updated_at=now() WHERE organization_id=$1 AND id=$2
           RETURNING id,name,provider,issuer_url AS "issuerUrl",client_id AS "clientId",redirect_uri AS "redirectUri",
             allowed_domains AS "allowedDomains",enabled,updated_at AS "updatedAt"`,
            [
              org,
              id,
              dto.name ?? null,
              dto.allowedDomains ? JSON.stringify(dto.allowedDomains) : null,
              dto.enabled ?? null,
              secret?.ciphertext ?? null,
              secret?.nonce ?? null,
              secret?.authTag ?? null,
              secret?.keyVersion ?? null,
            ],
          )
        )[0],
    );
  }

  ssoIssuer(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT issuer_url FROM whatsapp_core.enterprise_sso_connections WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0],
    );
  }

  recordSsoTest(org: string, id: string, ok: boolean, error?: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.enterprise_sso_connections SET last_tested_at=now(),last_test_status=$3,last_test_error=$4,updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [org, id, ok ? "SUCCESS" : "FAILED", error?.slice(0, 500) ?? null],
      ),
    );
  }

  deleteSso(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `DELETE FROM whatsapp_core.enterprise_sso_connections WHERE organization_id=$1 AND id=$2 RETURNING id`,
            [org, id],
          )
        )[0],
    );
  }

  privacy(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,request_type AS "requestType",subject_type AS "subjectType",subject_id AS "subjectId",status,jurisdiction,
         identity_verified_at AS "identityVerifiedAt",due_at AS "dueAt",legal_hold AS "legalHold",created_at AS "createdAt"
         FROM whatsapp_core.privacy_requests WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,
        [org],
      ),
    );
  }

  privacyRequest(org: string, id: string) {
    return this.tenants.run(org, async (m) => {
      const [request] = await m.query(
        `SELECT * FROM whatsapp_core.privacy_requests WHERE organization_id=$1 AND id=$2`,
        [org, id],
      );
      if (!request) return null;
      const events = await m.query(
        `SELECT event_type AS "eventType",from_status AS "fromStatus",to_status AS "toStatus",note,created_at AS "createdAt"
         FROM whatsapp_core.privacy_request_events WHERE organization_id=$1 AND privacy_request_id=$2 ORDER BY created_at,id`,
        [org, id],
      );
      return { ...request, events };
    });
  }

  createPrivacy(org: string, user: string, dto: any, dueAt: Date) {
    return this.tenants.run(org, async (m) => {
      const table = dto.subjectType === "USER" ? "users" : "contacts";
      const ownership =
        dto.subjectType === "USER"
          ? await m.query(
              `SELECT 1 FROM whatsapp_core.organization_members WHERE organization_id=$1 AND user_id=$2`,
              [org, dto.subjectId],
            )
          : await m.query(
              `SELECT 1 FROM whatsapp_core.${table} WHERE organization_id=$1 AND id=$2`,
              [org, dto.subjectId],
            );
      if (!ownership.length) return null;
      const [row] = await m.query(
        `INSERT INTO whatsapp_core.privacy_requests(organization_id,request_type,subject_type,subject_id,jurisdiction,
         requester_user_id,identity_verified_at,due_at,status) VALUES($1,$2,$3,$4,$5,$6,now(),$7,'IDENTITY_VERIFIED') RETURNING *`,
        [
          org,
          dto.requestType,
          dto.subjectType,
          dto.subjectId,
          dto.jurisdiction,
          user,
          dueAt,
        ],
      );
      await m.query(
        `INSERT INTO whatsapp_core.privacy_request_events(organization_id,privacy_request_id,actor_user_id,event_type,to_status)
         VALUES($1,$2,$3,'REQUEST_CREATED','IDENTITY_VERIFIED')`,
        [org, row.id, user],
      );
      return row;
    });
  }

  retention(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,data_category AS "dataCategory",retention_days AS "retentionDays",legal_basis AS "legalBasis",
         deletion_method AS "deletionMethod",legal_hold AS "legalHold",effective_at AS "effectiveAt",updated_at AS "updatedAt"
         FROM whatsapp_core.data_retention_policies WHERE organization_id=$1 ORDER BY data_category`,
        [org],
      ),
    );
  }

  updateRetention(org: string, user: string, id: string, dto: any) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.data_retention_policies SET retention_days=$3,legal_basis=$4,deletion_method=$5,
           legal_hold=$6,effective_at=now(),updated_by_user_id=$2,updated_at=now() WHERE organization_id=$1 AND id=$7 RETURNING *`,
            [
              org,
              user,
              dto.retentionDays,
              dto.legalBasis,
              dto.deletionMethod,
              dto.legalHold,
              id,
            ],
          )
        )[0],
    );
  }

  deletionJobs(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT j.id,p.data_category AS "dataCategory",j.status,j.cutoff_at AS "cutoffAt",j.rows_processed AS "rowsProcessed",
         j.error_code AS "errorCode",j.started_at AS "startedAt",j.completed_at AS "completedAt",j.created_at AS "createdAt"
         FROM whatsapp_core.data_deletion_jobs j JOIN whatsapp_core.data_retention_policies p ON p.id=j.policy_id AND p.organization_id=j.organization_id
         WHERE j.organization_id=$1 ORDER BY j.created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }

  residency(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT requested_region AS "requestedRegion",actual_region AS "actualRegion",status,transfer_restricted AS "transferRestricted",
           verified_at AS "verifiedAt",verification_reference AS "verificationReference",updated_at AS "updatedAt"
           FROM whatsapp_core.data_residency_assignments WHERE organization_id=$1`,
            [org],
          )
        )[0],
    );
  }

  sessions(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT s.id,s.user_id AS "userId",u.full_name AS "fullName",u.email_display AS email,s.ip_address AS "ipAddress",
         s.user_agent AS "userAgent",s.auth_method AS "authMethod",s.mfa_verified_at AS "mfaVerifiedAt",
         s.last_seen_at AS "lastSeenAt",s.expires_at AS "expiresAt",s.created_at AS "createdAt"
         FROM whatsapp_core.sessions s JOIN whatsapp_core.users u ON u.id=s.user_id
         WHERE s.revoked_at IS NULL AND s.expires_at>now() AND EXISTS(
           SELECT 1 FROM whatsapp_core.organization_members m WHERE m.organization_id=$1 AND m.user_id=s.user_id AND m.status='ACTIVE')
         ORDER BY s.last_seen_at DESC NULLS LAST LIMIT 200`,
        [org],
      ),
    );
  }

  revokeSessions(
    org: string,
    actor: string,
    userId: string | undefined,
    reason: string,
  ) {
    return this.tenants.run(org, async (m) => {
      if (userId) {
        const member = await m.query(
          `SELECT 1 FROM whatsapp_core.organization_members WHERE organization_id=$1 AND user_id=$2`,
          [org, userId],
        );
        if (!member.length) return 0;
      }
      const result = await m.query(
        `UPDATE whatsapp_core.sessions s SET revoked_at=now(),revocation_reason=$3
         WHERE s.revoked_at IS NULL AND s.user_id IN (SELECT user_id FROM whatsapp_core.organization_members WHERE organization_id=$1 AND status='ACTIVE')
           AND ($2::uuid IS NULL OR s.user_id=$2) RETURNING s.id`,
        [org, userId ?? null, reason],
      );
      await m.query(
        `INSERT INTO whatsapp_core.audit_logs(organization_id,actor_user_id,action,resource_type,metadata)
         VALUES($1,$2,'enterprise.sessions.revoked','session',jsonb_build_object('count',$3))`,
        [org, actor, result.length],
      );
      return result.length;
    });
  }

  async platformHealth() {
    const [db] = await this.dataSource.query(
      `SELECT now() database_time,pg_database_size(current_database())::bigint database_bytes`,
    );
    const [counts] = await this.dataSource.query(
      `SELECT (SELECT count(*) FROM whatsapp_core.organizations WHERE status='ACTIVE')::integer active_tenants,
       (SELECT count(*) FROM whatsapp_core.security_incidents WHERE status NOT IN ('RESOLVED','CLOSED'))::integer open_incidents,
       (SELECT count(*) FROM whatsapp_core.privacy_requests WHERE status NOT IN ('COMPLETED','REJECTED','CANCELLED') AND due_at<now())::integer overdue_privacy_requests`,
    );
    return { status: "OPERATIONAL", database: db, ...counts };
  }

  incidents() {
    return this.dataSource.query(
      `SELECT * FROM whatsapp_core.security_incidents ORDER BY detected_at DESC,id DESC LIMIT 200`,
    );
  }

  createIncident(adminId: string, dto: any) {
    return this.dataSource
      .query(
        `INSERT INTO whatsapp_core.security_incidents(organization_id,title,severity,category,summary,detected_at,created_by_platform_admin_id)
       VALUES($1,$2,$3,$4,$5,now(),$6) RETURNING *`,
        [
          dto.organizationId ?? null,
          dto.title,
          dto.severity,
          dto.category,
          dto.summary,
          adminId,
        ],
      )
      .then((rows) => rows[0]);
  }

  updateIncident(adminId: string, id: string, dto: any) {
    return this.dataSource.transaction(async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.security_incidents SET status=coalesce($2,status),assigned_platform_admin_id=coalesce($3,assigned_platform_admin_id),
         resolved_at=CASE WHEN $2 IN ('RESOLVED','CLOSED') THEN coalesce(resolved_at,now()) ELSE resolved_at END,updated_at=now() WHERE id=$1 RETURNING *`,
        [id, dto.status ?? null, dto.assignedPlatformAdminId ?? null],
      );
      if (!row) return null;
      await m.query(
        `INSERT INTO whatsapp_core.security_incident_events(incident_id,actor_platform_admin_id,event_type,note) VALUES($1,$2,$3,$4)`,
        [id, adminId, dto.status ? "STATUS_CHANGED" : "UPDATED", dto.note],
      );
      return row;
    });
  }

  adminPrivacy() {
    return this.dataSource.query(
      `SELECT p.*,o.name organization_name FROM whatsapp_core.privacy_requests p JOIN whatsapp_core.organizations o ON o.id=p.organization_id ORDER BY p.due_at,p.created_at LIMIT 200`,
    );
  }

  reviewPrivacy(adminId: string, id: string, dto: any) {
    return this.dataSource.transaction(async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.privacy_requests SET status=$2,decision_reason=$3,assigned_platform_admin_id=$4,
         completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE completed_at END,updated_at=now() WHERE id=$1 RETURNING *`,
        [id, dto.status, dto.reason, adminId],
      );
      if (!row) return null;
      await m.query(
        `INSERT INTO whatsapp_core.privacy_request_events(organization_id,privacy_request_id,actor_platform_admin_id,event_type,to_status,note)
         VALUES($1,$2,$3,'ADMIN_REVIEW',$4,$5)`,
        [row.organization_id, id, adminId, dto.status, dto.reason],
      );
      return row;
    });
  }

  tenantSecurity() {
    return this.dataSource.query(
      `SELECT o.id,o.name,o.status,p.require_mfa,p.session_lifetime_minutes,p.idle_timeout_minutes,
       count(DISTINCT s.id) FILTER(WHERE s.revoked_at IS NULL AND s.expires_at>now())::integer active_sessions,
       count(DISTINCT f.id) FILTER(WHERE f.status='ACTIVE')::integer active_mfa_factors
       FROM whatsapp_core.organizations o LEFT JOIN whatsapp_core.organization_security_policies p ON p.organization_id=o.id
       LEFT JOIN whatsapp_core.organization_members m ON m.organization_id=o.id AND m.status='ACTIVE'
       LEFT JOIN whatsapp_core.sessions s ON s.user_id=m.user_id
       LEFT JOIN whatsapp_core.user_mfa_factors f ON f.user_id=m.user_id
       GROUP BY o.id,o.name,o.status,p.require_mfa,p.session_lifetime_minutes,p.idle_timeout_minutes ORDER BY o.created_at DESC`,
    );
  }

  tenantResidency() {
    return this.dataSource.query(
      `SELECT o.id,o.name,r.requested_region,r.actual_region,r.status,r.transfer_restricted,r.verified_at
       FROM whatsapp_core.organizations o JOIN whatsapp_core.data_residency_assignments r ON r.organization_id=o.id ORDER BY o.created_at DESC`,
    );
  }

  backups() {
    return this.dataSource.query(
      `SELECT * FROM whatsapp_core.backup_verification_records ORDER BY created_at DESC LIMIT 100`,
    );
  }

  recordBackup(adminId: string, dto: any) {
    return this.dataSource
      .query(
        `INSERT INTO whatsapp_core.backup_verification_records(region,backup_reference,backup_type,status,started_at,completed_at,evidence_reference,verified_by_platform_admin_id)
       VALUES($1,$2,$3,$4,now(),now(),$5,$6) RETURNING *`,
        [
          dto.region,
          dto.backupReference,
          dto.backupType,
          dto.status,
          dto.evidenceReference ?? null,
          adminId,
        ],
      )
      .then((rows) => rows[0]);
  }

  platformAudit() {
    return this.dataSource.query(
      `SELECT id,actor_platform_admin_id,action,resource_type,resource_id,request_id,metadata,created_at
       FROM whatsapp_core.audit_logs WHERE actor_platform_admin_id IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 200`,
    );
  }

  scanRetentionJobs() {
    return this.tenants.runAsPlatformAdmin(async (m) =>
      m.query(
        `INSERT INTO whatsapp_core.data_deletion_jobs(organization_id,policy_id,cutoff_at)
         SELECT p.organization_id,p.id,now()-(p.retention_days || ' days')::interval
         FROM whatsapp_core.data_retention_policies p
         WHERE p.legal_hold=false AND p.effective_at<=now()
           AND p.data_category IN ('MESSAGE_CONTENT','API_REQUEST_LOGS','SECURITY_LOGS')
           AND NOT EXISTS(SELECT 1 FROM whatsapp_core.data_deletion_jobs j WHERE j.policy_id=p.id AND j.status IN ('PENDING','RUNNING'))
           AND NOT EXISTS(SELECT 1 FROM whatsapp_core.data_deletion_jobs j WHERE j.policy_id=p.id AND j.status='COMPLETED' AND j.completed_at>now()-interval '23 hours')
         RETURNING id,organization_id`,
      ),
    );
  }

  retentionJob(id: string) {
    return this.tenants.runAsPlatformAdmin(
      async (m) =>
        (
          await m.query(
            `SELECT j.*,p.data_category,p.deletion_method,p.legal_hold FROM whatsapp_core.data_deletion_jobs j
           JOIN whatsapp_core.data_retention_policies p ON p.id=j.policy_id AND p.organization_id=j.organization_id WHERE j.id=$1`,
            [id],
          )
        )[0],
    );
  }

  claimRetentionJob(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.data_deletion_jobs SET status='RUNNING',started_at=coalesce(started_at,now()),updated_at=now()
           WHERE id=$1 AND organization_id=$2 AND status IN ('PENDING','RUNNING','FAILED') RETURNING id`,
            [id, org],
          )
        )[0],
    );
  }

  processRetentionBatch(job: any) {
    return this.tenants.run(job.organization_id, async (m) => {
      let rows: any[];
      if (job.data_category === "API_REQUEST_LOGS")
        rows = await m.query(
          `WITH batch AS (SELECT id FROM whatsapp_core.api_request_logs WHERE organization_id=$1 AND created_at<$2 ORDER BY created_at,id LIMIT 500)
           DELETE FROM whatsapp_core.api_request_logs t USING batch WHERE t.id=batch.id RETURNING t.id`,
          [job.organization_id, job.cutoff_at],
        );
      else if (job.data_category === "SECURITY_LOGS")
        rows = await m.query(
          `WITH batch AS (SELECT id FROM whatsapp_core.security_events WHERE organization_id=$1 AND created_at<$2 AND (ip_address IS NOT NULL OR metadata<>'{}'::jsonb) ORDER BY created_at,id LIMIT 500)
           UPDATE whatsapp_core.security_events t SET ip_address=NULL,metadata='{}'::jsonb FROM batch WHERE t.id=batch.id RETURNING t.id`,
          [job.organization_id, job.cutoff_at],
        );
      else
        rows = await m.query(
          `WITH batch AS (SELECT id FROM whatsapp_core.messages WHERE organization_id=$1 AND created_at<$2 AND content_ciphertext IS NOT NULL ORDER BY created_at,id LIMIT 500)
           UPDATE whatsapp_core.messages t SET content_ciphertext=NULL,content_nonce=NULL,content_auth_tag=NULL,content_key_version=NULL,updated_at=now()
           FROM batch WHERE t.id=batch.id RETURNING t.id`,
          [job.organization_id, job.cutoff_at],
        );
      await m.query(
        `UPDATE whatsapp_core.data_deletion_jobs SET rows_processed=rows_processed+$3,
         status=CASE WHEN $3<500 THEN 'COMPLETED' ELSE 'RUNNING' END,
         completed_at=CASE WHEN $3<500 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 AND organization_id=$2`,
        [job.id, job.organization_id, rows.length],
      );
      return rows.length;
    });
  }

  failRetentionJob(org: string, id: string, error: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.data_deletion_jobs SET status='FAILED',error_code=$3,updated_at=now() WHERE id=$1 AND organization_id=$2`,
        [id, org, error.slice(0, 100)],
      ),
    );
  }
}
