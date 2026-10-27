import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import { ListApiLogsDto } from "./dto/developer-portal.dto";
import { EncryptedField } from "../security/encryption/field-encryption.service";

@Injectable()
export class DeveloperPortalRepository {
  constructor(private readonly tenants: TenantContextService) {}

  userPermissions(org: string, user: string) {
    return this.tenants.run(org, async (manager) =>
      (
        await manager.query(
          `SELECT DISTINCT p.code FROM whatsapp_core.organization_members m
           JOIN whatsapp_core.roles r ON r.id=m.role_id
           JOIN whatsapp_core.role_permissions rp ON rp.role_id=r.id
           JOIN whatsapp_core.permissions p ON p.id=rp.permission_id
           WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='ACTIVE' AND r.status='ACTIVE' AND p.status='ACTIVE'`,
          [org, user],
        )
      ).map((row: any) => row.code),
    );
  }

  createKey(
    org: string,
    user: string,
    input: {
      id: string;
      name: string;
      publicId: string;
      verifier: string;
      environment: string;
      expiresAt: Date | null;
      scopes: string[];
      networks: string[];
      mtlsFingerprints: string[];
      encryptedSigningSecret: EncryptedField;
      rotatedFromId?: string;
    },
  ) {
    return this.tenants.run(org, async (manager) => {
      const [key] = await manager.query(
        `INSERT INTO whatsapp_core.api_keys
          (id,organization_id,name,public_id,secret_verifier,environment,expires_at,created_by_user_id,rotated_from_id,signing_secret_ciphertext,signing_secret_nonce,signing_secret_auth_tag,signing_key_version,mtls_required)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,name,public_id,environment,status,expires_at,created_at,rotated_from_id,mtls_required`,
        [
          input.id,
          org,
          input.name,
          input.publicId,
          input.verifier,
          input.environment,
          input.expiresAt,
          user,
          input.rotatedFromId ?? null,
          input.encryptedSigningSecret.ciphertext,
          input.encryptedSigningSecret.nonce,
          input.encryptedSigningSecret.authTag,
          input.encryptedSigningSecret.keyVersion,
          input.mtlsFingerprints.length > 0,
        ],
      );
      for (const scope of input.scopes)
        await manager.query(
          `INSERT INTO whatsapp_core.api_key_scopes(api_key_id,organization_id,scope) VALUES($1,$2,$3)`,
          [key.id, org, scope],
        );
      for (const network of input.networks)
        await manager.query(
          `INSERT INTO whatsapp_core.api_key_ip_allowlists(api_key_id,organization_id,network) VALUES($1,$2,$3::cidr)`,
          [key.id, org, network],
        );
      for (const fingerprint of input.mtlsFingerprints)
        await manager.query(
          `INSERT INTO whatsapp_core.api_key_mtls_fingerprints(api_key_id,organization_id,fingerprint_sha256) VALUES($1,$2,$3)`,
          [key.id, org, fingerprint],
        );
      return {
        ...key,
        scopes: input.scopes,
        ipAllowlist: input.networks,
        mtlsFingerprints: input.mtlsFingerprints,
      };
    });
  }

  listKeys(org: string) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `SELECT k.id,k.name,k.public_id,k.environment,k.mtls_required,CASE WHEN k.status='ACTIVE' AND k.expires_at<=now() THEN 'EXPIRED' ELSE k.status END status,k.expires_at,k.last_used_at,k.revoked_at,k.rotated_from_id,k.created_at,
          coalesce(array_agg(DISTINCT s.scope) FILTER(WHERE s.scope IS NOT NULL),'{}') scopes,
          coalesce(array_agg(DISTINCT i.network::text) FILTER(WHERE i.network IS NOT NULL),'{}') ip_allowlist
         FROM whatsapp_core.api_keys k
         LEFT JOIN whatsapp_core.api_key_scopes s ON s.api_key_id=k.id
         LEFT JOIN whatsapp_core.api_key_ip_allowlists i ON i.api_key_id=k.id
         WHERE k.organization_id=$1 GROUP BY k.id ORDER BY k.created_at DESC`,
        [org],
      ),
    );
  }

  getKey(org: string, id: string) {
    return this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `SELECT k.*,CASE WHEN k.status='ACTIVE' AND k.expires_at<=now() THEN 'EXPIRED' ELSE k.status END status,coalesce(array_agg(DISTINCT s.scope) FILTER(WHERE s.scope IS NOT NULL),'{}') scopes,
              coalesce(array_agg(DISTINCT i.network::text) FILTER(WHERE i.network IS NOT NULL),'{}') ip_allowlist,
              coalesce(array_agg(DISTINCT f.fingerprint_sha256) FILTER(WHERE f.fingerprint_sha256 IS NOT NULL),'{}') mtls_fingerprints
             FROM whatsapp_core.api_keys k
             LEFT JOIN whatsapp_core.api_key_scopes s ON s.api_key_id=k.id
             LEFT JOIN whatsapp_core.api_key_ip_allowlists i ON i.api_key_id=k.id
             LEFT JOIN whatsapp_core.api_key_mtls_fingerprints f ON f.api_key_id=k.id
             WHERE k.organization_id=$1 AND k.id=$2 GROUP BY k.id`,
            [org, id],
          )
        )[0] ?? null,
    );
  }

  revokeKey(org: string, id: string, user: string, reason: string | null) {
    return this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.api_keys SET status='REVOKED',revoked_at=now(),revoked_by_user_id=$3,revoke_reason=$4,updated_at=now()
             WHERE organization_id=$1 AND id=$2 AND status='ACTIVE' RETURNING id,status,revoked_at`,
            [org, id, user, reason],
          )
        )[0] ?? null,
    );
  }

  async authenticate(publicId: string, sourceIp: string) {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const [key] = await manager.query(
        `SELECT k.id,k.organization_id,k.public_id,k.secret_verifier,k.environment,k.status,k.expires_at,k.signing_secret_ciphertext,k.signing_secret_nonce,k.signing_secret_auth_tag,k.signing_key_version,k.mtls_required,o.status organization_status,o.api_access_enabled,
          coalesce(array_agg(DISTINCT s.scope) FILTER(WHERE s.scope IS NOT NULL),'{}') scopes,
          count(DISTINCT i.id)::integer allowlist_count,
          coalesce(bool_or($2::inet <<= i.network),false) ip_allowed,
          coalesce(array_agg(DISTINCT f.fingerprint_sha256) FILTER(WHERE f.fingerprint_sha256 IS NOT NULL),'{}') mtls_fingerprints,
          EXISTS(SELECT 1 FROM whatsapp_core.subscriptions sub WHERE sub.organization_id=k.organization_id AND sub.status IN ('TRIALING','ACTIVE','PAST_DUE') AND sub.current_period_end>now()) subscription_active
         FROM whatsapp_core.api_keys k
         JOIN whatsapp_core.organizations o ON o.id=k.organization_id
         LEFT JOIN whatsapp_core.api_key_scopes s ON s.api_key_id=k.id
         LEFT JOIN whatsapp_core.api_key_ip_allowlists i ON i.api_key_id=k.id
         LEFT JOIN whatsapp_core.api_key_mtls_fingerprints f ON f.api_key_id=k.id
         WHERE k.public_id=$1 GROUP BY k.id,o.id`,
        [publicId, sourceIp],
      );
      return key ?? null;
    });
  }

  getSpendingCap(org: string) {
    return this.tenants.run(org, async (manager) => {
      const [row] = await manager.query(
        `SELECT o.api_monthly_spend_cap_minor,o.currency_code,
          coalesce(sum(r.amount_minor) FILTER(WHERE r.status='COMMITTED' OR (r.status='RESERVED' AND r.expires_at>now())),0)::bigint spent_or_reserved_minor
         FROM whatsapp_core.organizations o
         LEFT JOIN whatsapp_core.api_spend_reservations r ON r.organization_id=o.id AND r.period_start=date_trunc('month',now())
         WHERE o.id=$1 GROUP BY o.id`,
        [org],
      );
      return row;
    });
  }

  updateSpendingCap(org: string, amountMinor: number | null) {
    return this.tenants.run(org, async (manager) => {
      const [row] = await manager.query(
        `UPDATE whatsapp_core.organizations SET api_monthly_spend_cap_minor=$2,updated_at=now() WHERE id=$1
         RETURNING api_monthly_spend_cap_minor,currency_code`,
        [org, amountMinor],
      );
      return row;
    });
  }

  reserveMessageSpend(
    org: string,
    apiKeyId: string,
    operationKey: string,
    recipientPhone: string,
    templateId: string,
  ) {
    return this.tenants.run(org, async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
        [`api-spend:${org}`],
      );
      const [existing] = await manager.query(
        `SELECT id,amount_minor,currency,status FROM whatsapp_core.api_spend_reservations WHERE organization_id=$1 AND operation_key=$2`,
        [org, operationKey],
      );
      if (existing) return { reservation: existing, existing: true };
      const [quote] = await manager.query(
        `SELECT o.api_monthly_spend_cap_minor,o.currency_code,p.amount_minor
         FROM whatsapp_core.organizations o
         LEFT JOIN whatsapp_core.contacts c ON c.organization_id=o.id AND c.phone_e164=$2 AND c.deleted_at IS NULL
         LEFT JOIN whatsapp_core.message_templates t ON t.organization_id=o.id AND t.id=$3
         LEFT JOIN LATERAL(
           SELECT amount_minor FROM whatsapp_core.messaging_price_versions p
           WHERE p.country_code=c.country_code AND p.currency=o.currency_code AND p.category=t.category
             AND p.effective_from<=now() AND (p.effective_to IS NULL OR p.effective_to>now())
           ORDER BY p.effective_from DESC LIMIT 1
         ) p ON true WHERE o.id=$1`,
        [org, recipientPhone, templateId],
      );
      if (quote.api_monthly_spend_cap_minor === null)
        return { reservation: null, disabled: true };
      if (quote.amount_minor === null)
        return { reservation: null, priceUnavailable: true };
      const [usage] = await manager.query(
        `SELECT coalesce(sum(amount_minor) FILTER(WHERE status='COMMITTED' OR (status='RESERVED' AND expires_at>now())),0)::bigint total
         FROM whatsapp_core.api_spend_reservations WHERE organization_id=$1 AND period_start=date_trunc('month',now())`,
        [org],
      );
      if (
        BigInt(usage.total) + BigInt(quote.amount_minor) >
        BigInt(quote.api_monthly_spend_cap_minor)
      )
        return { reservation: null, exceeded: true };
      const [reservation] = await manager.query(
        `INSERT INTO whatsapp_core.api_spend_reservations
          (organization_id,api_key_id,operation_key,currency,amount_minor,period_start,period_end)
         VALUES($1,$2,$3,$4,$5,date_trunc('month',now()),date_trunc('month',now())+interval '1 month')
         RETURNING id,amount_minor,currency,status`,
        [org, apiKeyId, operationKey, quote.currency_code, quote.amount_minor],
      );
      return { reservation, existing: false };
    });
  }

  finishSpendReservation(org: string, id: string, committed: boolean) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `UPDATE whatsapp_core.api_spend_reservations
         SET status=$3,committed_at=CASE WHEN $3='COMMITTED' THEN now() END,released_at=CASE WHEN $3='RELEASED' THEN now() END
         WHERE organization_id=$1 AND id=$2 AND status='RESERVED'`,
        [org, id, committed ? "COMMITTED" : "RELEASED"],
      ),
    );
  }

  touchKey(org: string, id: string) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `UPDATE whatsapp_core.api_keys SET last_used_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }

  appendSecurityEvent(input: {
    organizationId?: string;
    apiKeyId?: string;
    eventType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    sourceIp: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.tenants.runAsPlatformAdmin((manager) =>
      manager.query(
        `INSERT INTO whatsapp_core.api_security_events(organization_id,api_key_id,event_type,severity,source_ip,metadata)
         VALUES($1,$2,$3,$4,$5::inet,$6::jsonb)`,
        [
          input.organizationId ?? null,
          input.apiKeyId ?? null,
          input.eventType,
          input.severity,
          input.sourceIp,
          JSON.stringify(input.metadata ?? {}),
        ],
      ),
    );
  }

  appendRequestLog(input: {
    requestId: string;
    organizationId: string;
    apiKeyId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    sourceIp: string;
    errorCode?: string;
    environment: string;
    messageOperationId?: string;
  }) {
    return this.tenants.run(input.organizationId, (manager) =>
      manager.query(
        `INSERT INTO whatsapp_core.api_request_logs
          (request_id,organization_id,api_key_id,endpoint,method,status_code,latency_ms,source_ip,error_code,environment,message_operation_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::inet,$9,$10,$11) ON CONFLICT(request_id) DO NOTHING`,
        [
          input.requestId,
          input.organizationId,
          input.apiKeyId,
          input.endpoint.slice(0, 160),
          input.method,
          input.statusCode,
          input.latencyMs,
          input.sourceIp,
          input.errorCode ?? null,
          input.environment,
          input.messageOperationId ?? null,
        ],
      ),
    );
  }

  listLogs(org: string, query: ListApiLogsDto) {
    return this.tenants.run(org, async (manager) => {
      const rows = await manager.query(
        `SELECT l.request_id,l.endpoint,l.method,l.status_code,l.latency_ms,l.source_ip::text source_ip,l.error_code,l.environment,l.message_operation_id,l.created_at,k.name key_name,
          count(*) OVER()::integer total
         FROM whatsapp_core.api_request_logs l JOIN whatsapp_core.api_keys k ON k.id=l.api_key_id
         WHERE l.organization_id=$1 AND ($2::varchar IS NULL OR l.endpoint=$2) AND ($3::smallint IS NULL OR l.status_code=$3) AND ($4::uuid IS NULL OR l.request_id=$4)
         ORDER BY l.created_at DESC,l.id DESC LIMIT $5 OFFSET $6`,
        [
          org,
          query.endpoint ?? null,
          query.status ?? null,
          query.requestId ?? null,
          query.limit,
          (query.page - 1) * query.limit,
        ],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: rows[0]?.total ?? 0,
        page: query.page,
        limit: query.limit,
      };
    });
  }

  overview(org: string) {
    return this.tenants.run(org, async (manager) => {
      const [row] = await manager.query(
        `SELECT
          (SELECT count(*)::integer FROM whatsapp_core.api_keys WHERE organization_id=$1 AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>now())) active_keys,
          (SELECT count(*)::integer FROM whatsapp_core.api_request_logs WHERE organization_id=$1 AND created_at>=now()-interval '24 hours') requests_24h,
          (SELECT coalesce(round(100.0*count(*) FILTER(WHERE status_code>=400)/nullif(count(*),0),2),0) FROM whatsapp_core.api_request_logs WHERE organization_id=$1 AND created_at>=now()-interval '24 hours') error_rate,
          (SELECT coalesce(round(avg(latency_ms)),0)::integer FROM whatsapp_core.api_request_logs WHERE organization_id=$1 AND created_at>=now()-interval '24 hours') avg_latency_ms,
          (SELECT api_access_enabled FROM whatsapp_core.organizations WHERE id=$1) api_access_enabled`,
        [org],
      );
      return row;
    });
  }

  claimIdempotency(
    org: string,
    keyId: string,
    operation: string,
    key: string,
    fingerprint: string,
  ) {
    return this.tenants.run(org, async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
        [`${org}:${keyId}:${operation}:${key}`],
      );
      const [existing] = await manager.query(
        `SELECT id,request_fingerprint,status,response_status,response_body FROM whatsapp_core.public_idempotency_records
         WHERE organization_id=$1 AND api_key_id=$2 AND operation=$3 AND idempotency_key=$4 AND expires_at>now()`,
        [org, keyId, operation, key],
      );
      if (existing) return { ...existing, created: false };
      const inserted = (
        await manager.query(
          `INSERT INTO whatsapp_core.public_idempotency_records(organization_id,api_key_id,operation,idempotency_key,request_fingerprint)
           VALUES($1,$2,$3,$4,$5) RETURNING id,request_fingerprint,status,response_status,response_body`,
          [org, keyId, operation, key, fingerprint],
        )
      )[0];
      return { ...inserted, created: true };
    });
  }

  finishIdempotency(org: string, id: string, status: number, body: unknown) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `UPDATE whatsapp_core.public_idempotency_records SET status='COMPLETED',response_status=$3,response_body=$4::jsonb WHERE organization_id=$1 AND id=$2`,
        [org, id, status, JSON.stringify(body)],
      ),
    );
  }

  failIdempotency(org: string, id: string) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `UPDATE whatsapp_core.public_idempotency_records SET status='FAILED' WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }

  publicUsage(org: string) {
    return this.tenants.run(org, async (manager) => {
      const [row] = await manager.query(
        `SELECT count(*) FILTER(WHERE created_at>=date_trunc('day',now()))::integer requests_today,
          count(*) FILTER(WHERE status_code=429 AND created_at>=date_trunc('day',now()))::integer rate_limited_today,
          coalesce(round(avg(latency_ms)) FILTER(WHERE created_at>=date_trunc('day',now())),0)::integer avg_latency_ms
         FROM whatsapp_core.api_request_logs WHERE organization_id=$1`,
        [org],
      );
      return row;
    });
  }

  sandboxMessage(org: string, keyId: string, messageId: string) {
    return this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `SELECT response_body,created_at FROM whatsapp_core.public_idempotency_records
             WHERE organization_id=$1 AND api_key_id=$2 AND operation='messages.template' AND response_body->>'message_id'=$3
             ORDER BY created_at DESC LIMIT 1`,
            [org, keyId, messageId],
          )
        )[0] ?? null,
    );
  }
}
