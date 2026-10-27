import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { BaseRepository } from "src/default/common/repositories/base.repository";
import { PlatformAdminEntity } from "../database/entities";
import {
  CreateAdminPlanDto,
  CreateBillingAdjustmentDto,
  UpdateAdminPlanDto,
  AdminCustomerListDto,
} from "./dto/platform-admin.dto";

@Injectable()
export class PlatformAdminRepository extends BaseRepository<PlatformAdminEntity> {
  constructor(
    @InjectRepository(PlatformAdminEntity)
    repository: Repository<PlatformAdminEntity>,
    private readonly dataSource: DataSource,
  ) {
    super(repository);
  }

  billingOverview() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (
        await m.query(
          `SELECT
            (SELECT count(*) FROM whatsapp_core.subscriptions WHERE status IN ('TRIALING','ACTIVE','PAST_DUE'))::integer active_subscriptions,
            (SELECT count(*) FROM whatsapp_core.subscriptions WHERE status='TRIALING')::integer trials,
            (SELECT coalesce(sum(CASE WHEN pr.interval='YEAR' THEN pr.amount_minor/12 ELSE pr.amount_minor END),0) FROM whatsapp_core.subscriptions s JOIN whatsapp_core.plan_prices pr ON pr.id=s.price_id WHERE s.status='ACTIVE')::bigint mrr_minor,
            (SELECT coalesce(sum(amount_minor-refunded_minor),0) FROM whatsapp_core.payments WHERE status IN ('PAID','REFUNDED') AND paid_at>=date_trunc('month',now()))::bigint collected_this_month_minor,
            (SELECT count(*) FROM whatsapp_core.payments WHERE status='FAILED' AND created_at>=date_trunc('month',now()))::integer failed_payments`,
        )
      )[0];
    });
  }
  platformOverview() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (
        await m.query(
          `SELECT
            (SELECT count(*) FROM whatsapp_core.organizations WHERE deleted_at IS NULL)::integer organizations,
            (SELECT count(*) FROM whatsapp_core.organizations WHERE status='ACTIVE' AND deleted_at IS NULL)::integer active_organizations,
            (SELECT count(*) FROM whatsapp_core.organizations WHERE created_at>=date_trunc('month',now()) AND deleted_at IS NULL)::integer new_organizations_this_month,
            (SELECT count(*) FROM whatsapp_core.subscriptions WHERE status IN ('TRIALING','ACTIVE','PAST_DUE'))::integer active_subscriptions,
            (SELECT count(*) FROM whatsapp_core.subscriptions WHERE status='TRIALING')::integer trials,
            (SELECT count(*) FROM whatsapp_core.contacts WHERE deleted_at IS NULL)::bigint contacts,
            (SELECT count(*) FROM whatsapp_core.campaigns)::bigint campaigns,
            (SELECT count(*) FROM whatsapp_core.messages)::bigint messages,
            (SELECT count(*) FROM whatsapp_core.messages WHERE created_at>=date_trunc('month',now()))::bigint messages_this_month,
            (SELECT count(*) FROM whatsapp_core.messages WHERE created_at>=date_trunc('month',now()) AND status IN ('DELIVERED','READ'))::bigint delivered_this_month,
            (SELECT count(*) FROM whatsapp_core.messages WHERE created_at>=date_trunc('month',now()) AND status='READ')::bigint read_this_month,
            (SELECT count(*) FROM whatsapp_core.messages WHERE created_at>=date_trunc('month',now()) AND status='FAILED')::bigint failed_this_month,
            (SELECT count(*) FROM whatsapp_core.meta_connections WHERE status IN ('CONNECTED','ACTIVE'))::integer connected_meta_accounts,
            (SELECT count(*) FROM whatsapp_core.audit_logs WHERE created_at>=date_trunc('month',now()))::bigint audit_events_this_month`,
        )
      )[0];
    });
  }
  customers(dto: AdminCustomerListDto) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      const rows = await this.customerRows(
        m,
        null,
        dto.search?.trim() || null,
        dto.limit,
        (dto.page - 1) * dto.limit,
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: Number(rows[0]?.total ?? 0),
        page: dto.page,
        limit: dto.limit,
      };
    });
  }
  customer(id: string) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (await this.customerRows(m, id, null, 1, 0))[0] ?? null;
    });
  }
  customerAudit(id: string, dto: AdminCustomerListDto) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      const rows = await m.query(
        `SELECT a.id,a.action,a.resource_type,a.resource_id,a.ip_address,a.request_id,a.metadata,a.created_at,
                u.email_display actor_email,u.full_name actor_name,count(*) OVER()::integer total
         FROM whatsapp_core.audit_logs a
         LEFT JOIN whatsapp_core.users u ON u.id=a.actor_user_id
         WHERE a.organization_id=$1
         ORDER BY a.created_at DESC,a.id DESC LIMIT $2 OFFSET $3`,
        [id, dto.limit, (dto.page - 1) * dto.limit],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: Number(rows[0]?.total ?? 0),
        page: dto.page,
        limit: dto.limit,
      };
    });
  }
  customerJourney(id: string, dto: AdminCustomerListDto) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      const rows = await m.query(
        `WITH ranked AS (
           SELECT j.*,row_number() OVER(
             PARTITION BY j.user_id,j.session_id,j.event_type,j.path,date_trunc('second',j.created_at)
             ORDER BY j.created_at,j.id
           ) duplicate_rank
           FROM whatsapp_core.user_journey_events j WHERE j.organization_id=$1
         )
         SELECT j.id,j.event_type,j.path,j.created_at,u.email_display user_email,u.full_name user_name,
                count(*) OVER()::integer total
         FROM ranked j
         JOIN whatsapp_core.users u ON u.id=j.user_id
         WHERE j.duplicate_rank=1
         ORDER BY j.created_at DESC,j.id DESC LIMIT $2 OFFSET $3`,
        [id, dto.limit, (dto.page - 1) * dto.limit],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: Number(rows[0]?.total ?? 0),
        page: dto.page,
        limit: dto.limit,
      };
    });
  }

  private customerRows(
    manager: EntityManager,
    id: string | null,
    search: string | null,
    limit: number,
    offset: number,
  ) {
    return manager.query(
      `SELECT o.id,o.name,o.slug,o.status,o.country_code,o.currency_code,o.timezone,o.data_region,o.created_at,o.updated_at,
              count(*) OVER()::integer total,
              owner.full_name owner_name,owner.email_display owner_email,
              coalesce(members.count,0)::integer members,
              s.id subscription_id,s.status subscription_status,s.created_at subscription_started_at,
              s.current_period_start,s.current_period_end,s.trial_end,s.cancel_at_period_end,
              coalesce(trials.trial_used,false) trial_used,trials.trial_started_at,trials.trial_ended_at,
              p.code plan_code,p.name plan_name,pr.currency,pr.amount_minor,pr.interval,
              coalesce(stats.messages,0)::bigint messages,coalesce(stats.messages_this_month,0)::bigint messages_this_month,
              coalesce(stats.delivered,0)::bigint delivered,coalesce(stats.read,0)::bigint read,
              coalesce(stats.failed,0)::bigint failed,coalesce(stats.campaigns,0)::bigint campaigns,
              coalesce(stats.contacts,0)::bigint contacts
       FROM whatsapp_core.organizations o
       LEFT JOIN LATERAL (
         SELECT u.full_name,u.email_display FROM whatsapp_core.organization_members om
         JOIN whatsapp_core.roles r ON r.id=om.role_id AND r.code='owner'
         JOIN whatsapp_core.users u ON u.id=om.user_id
         WHERE om.organization_id=o.id AND om.status='ACTIVE' ORDER BY om.joined_at LIMIT 1
       ) owner ON true
       LEFT JOIN LATERAL (SELECT count(*) FROM whatsapp_core.organization_members om WHERE om.organization_id=o.id AND om.status='ACTIVE') members ON true
       LEFT JOIN LATERAL (SELECT * FROM whatsapp_core.subscriptions x WHERE x.organization_id=o.id ORDER BY x.created_at DESC LIMIT 1) s ON true
       LEFT JOIN LATERAL (
         SELECT true trial_used,min(created_at) trial_started_at,max(trial_end) trial_ended_at
         FROM whatsapp_core.subscriptions x WHERE x.organization_id=o.id AND x.trial_end IS NOT NULL
         HAVING count(*)>0
       ) trials ON true
       LEFT JOIN whatsapp_core.subscription_plans p ON p.id=s.plan_id
       LEFT JOIN whatsapp_core.plan_prices pr ON pr.id=s.price_id
       LEFT JOIN LATERAL (
         SELECT
           (SELECT count(*) FROM whatsapp_core.messages x WHERE x.organization_id=o.id) messages,
           (SELECT count(*) FROM whatsapp_core.messages x WHERE x.organization_id=o.id AND x.created_at>=date_trunc('month',now())) messages_this_month,
           (SELECT count(*) FROM whatsapp_core.messages x WHERE x.organization_id=o.id AND x.status IN ('DELIVERED','READ')) delivered,
           (SELECT count(*) FROM whatsapp_core.messages x WHERE x.organization_id=o.id AND x.status='READ') read,
           (SELECT count(*) FROM whatsapp_core.messages x WHERE x.organization_id=o.id AND x.status='FAILED') failed,
           (SELECT count(*) FROM whatsapp_core.campaigns x WHERE x.organization_id=o.id) campaigns,
           (SELECT count(*) FROM whatsapp_core.contacts x WHERE x.organization_id=o.id AND x.deleted_at IS NULL) contacts
       ) stats ON true
       WHERE o.deleted_at IS NULL AND ($1::uuid IS NULL OR o.id=$1)
         AND ($2::text IS NULL OR o.name ILIKE '%'||$2||'%' OR o.slug ILIKE '%'||$2||'%' OR owner.email_display ILIKE '%'||$2||'%')
       ORDER BY o.created_at DESC,o.id DESC LIMIT $3 OFFSET $4`,
      [id, search, limit, offset],
    );
  }
  adminList(table: "subscriptions" | "payments" | "invoices") {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT * FROM whatsapp_core.${table} ORDER BY created_at DESC LIMIT 200`,
      );
    });
  }
  revenue() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT date_trunc('month',paid_at) month,currency,
          sum(amount_minor)::bigint gross_minor,sum(refunded_minor)::bigint refunds_minor,
          sum(amount_minor-refunded_minor)::bigint net_minor
         FROM whatsapp_core.payments WHERE paid_at IS NOT NULL GROUP BY 1,2 ORDER BY 1 DESC LIMIT 36`,
      );
    });
  }
  globalUsage() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT organization_id,metric_code,sum(quantity)::bigint quantity
         FROM whatsapp_core.usage_records WHERE occurred_at>=date_trunc('month',now())
         GROUP BY organization_id,metric_code ORDER BY quantity DESC LIMIT 500`,
      );
    });
  }
  apiOverview() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (
        await m.query(
          `SELECT
            (SELECT count(*) FROM whatsapp_core.api_keys WHERE status='ACTIVE' AND (expires_at IS NULL OR expires_at>now()))::integer active_keys,
            (SELECT count(*) FROM whatsapp_core.api_request_logs WHERE created_at>=now()-interval '24 hours')::bigint requests_24h,
            (SELECT count(*) FROM whatsapp_core.api_request_logs WHERE status_code=429 AND created_at>=now()-interval '24 hours')::bigint rate_limits_24h,
            (SELECT count(*) FROM whatsapp_core.api_request_logs WHERE status_code>=500 AND created_at>=now()-interval '24 hours')::bigint errors_24h,
            (SELECT count(*) FROM whatsapp_core.api_security_events WHERE severity IN ('HIGH','CRITICAL') AND created_at>=now()-interval '24 hours')::bigint security_alerts_24h,
            (SELECT count(*) FROM whatsapp_core.developer_webhook_endpoints WHERE status='DISABLED')::integer disabled_webhooks`,
        )
      )[0];
    });
  }
  apiKeys() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT k.id,k.organization_id,o.name organization_name,k.name,k.public_id,k.environment,k.status,k.expires_at,k.last_used_at,k.created_at,
          coalesce(array_agg(s.scope) FILTER(WHERE s.scope IS NOT NULL),'{}') scopes
         FROM whatsapp_core.api_keys k JOIN whatsapp_core.organizations o ON o.id=k.organization_id
         LEFT JOIN whatsapp_core.api_key_scopes s ON s.api_key_id=k.id
         GROUP BY k.id,o.id ORDER BY k.created_at DESC LIMIT 500`,
      );
    });
  }
  apiSecurityEvents() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT e.id,e.organization_id,o.name organization_name,e.api_key_id,e.event_type,e.severity,e.source_ip::text source_ip,e.metadata,e.created_at
         FROM whatsapp_core.api_security_events e LEFT JOIN whatsapp_core.organizations o ON o.id=e.organization_id
         ORDER BY e.created_at DESC LIMIT 500`,
      );
    });
  }
  setTenantApiStatus(org: string, enabled: boolean, adminId: string) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      const [result] = await m.query(
        `UPDATE whatsapp_core.organizations SET api_access_enabled=$2,updated_at=now() WHERE id=$1 RETURNING id,api_access_enabled`,
        [org, enabled],
      );
      if (result)
        await m.query(
          `INSERT INTO whatsapp_core.api_security_events(organization_id,event_type,severity,metadata)
           VALUES($1,$2,'CRITICAL',jsonb_build_object('platformAdminId',$3::text))`,
          [
            org,
            enabled ? "TENANT_API_ENABLED" : "TENANT_API_DISABLED",
            adminId,
          ],
        );
      return result ?? null;
    });
  }
  emergencyRevokeKey(id: string, adminId: string) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      const [key] = await m.query(
        `UPDATE whatsapp_core.api_keys SET status='REVOKED',revoked_at=now(),revoke_reason='Emergency platform revocation',updated_at=now()
         WHERE id=$1 AND status='ACTIVE' RETURNING id,organization_id,status,revoked_at`,
        [id],
      );
      if (key)
        await m.query(
          `INSERT INTO whatsapp_core.api_security_events(organization_id,api_key_id,event_type,severity,metadata)
           VALUES($1,$2,'API_KEY_EMERGENCY_REVOKED','CRITICAL',jsonb_build_object('platformAdminId',$3::text))`,
          [key.organization_id, id, adminId],
        );
      return key ?? null;
    });
  }
  platformAnalytics() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (
        await m.query(
          `SELECT count(*)::bigint messages,
            count(*) FILTER(WHERE status IN ('DELIVERED','READ'))::bigint delivered,
            count(*) FILTER(WHERE status='READ')::bigint read,
            count(*) FILTER(WHERE status='FAILED')::bigint failed
           FROM whatsapp_core.messages WHERE created_at>=date_trunc('month',now())`,
        )
      )[0];
    });
  }
  metaConnections() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT id,organization_id,status,provider_business_id,last_synced_at,created_at,updated_at
         FROM whatsapp_core.meta_connections ORDER BY created_at DESC LIMIT 200`,
      );
    });
  }
  metaErrors() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT id,organization_id,payload->>'field' event_type,status,attempts,received_at,processed_at
         FROM whatsapp_core.meta_webhook_events WHERE status='FAILED' ORDER BY received_at DESC LIMIT 200`,
      );
    });
  }
  metaHealth() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT status,count(*)::integer count FROM whatsapp_core.meta_connections GROUP BY status ORDER BY status`,
      );
    });
  }
  templates() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT id,organization_id,name,language,category,local_status,meta_status,raw_provider_status,rejection_reason,created_at,updated_at
         FROM whatsapp_core.message_templates ORDER BY created_at DESC LIMIT 200`,
      );
    });
  }
  templateMetrics() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT meta_status,count(*)::integer count FROM whatsapp_core.message_templates GROUP BY meta_status ORDER BY meta_status`,
      );
    });
  }
  reportJobs() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(
        `SELECT id,organization_id,type,format,status,created_at,completed_at,expires_at
         FROM whatsapp_core.report_exports ORDER BY created_at DESC LIMIT 200`,
      );
    });
  }
  inboxHealth() {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return m.query(`SELECT o.id organization_id,o.name,
        coalesce(c.active,0)::integer active_conversations,coalesce(c.unassigned,0)::integer unassigned,
        coalesce(msg.inbound,0)::integer inbound_24h,coalesce(e.failures,0)::integer webhook_failures_24h,c.last_message_at
       FROM whatsapp_core.organizations o
       LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE status IN ('OPEN','PENDING')) active,
         count(*) FILTER(WHERE assigned_user_id IS NULL AND status IN ('OPEN','PENDING')) unassigned,max(last_message_at) last_message_at
         FROM whatsapp_core.conversations WHERE organization_id=o.id) c ON true
       LEFT JOIN LATERAL (SELECT count(*) inbound FROM whatsapp_core.messages WHERE organization_id=o.id AND direction='INBOUND' AND created_at>=now()-interval '24 hours') msg ON true
       LEFT JOIN LATERAL (SELECT count(*) failures FROM whatsapp_core.meta_webhook_events WHERE organization_id=o.id AND status='FAILED' AND received_at>=now()-interval '24 hours') e ON true
       ORDER BY webhook_failures_24h DESC,active_conversations DESC LIMIT 500`);
    });
  }
  createPlan(dto: CreateAdminPlanDto) {
    return this.dataSource.transaction(async (m) => {
      const [plan] = await m.query(
        `INSERT INTO whatsapp_core.subscription_plans(code,version,name,description,trial_days,display_order,effective_from)
         VALUES(upper($1),(SELECT coalesce(max(version),0)+1 FROM whatsapp_core.subscription_plans WHERE code=upper($1)),$2,$3,$4,$5,$6)
         RETURNING *`,
        [
          dto.code,
          dto.name,
          dto.description ?? null,
          dto.trialDays,
          dto.displayOrder,
          dto.effectiveFrom,
        ],
      );
      for (const feature of dto.features)
        await m.query(
          `INSERT INTO whatsapp_core.plan_features(plan_id,code,enabled,quota) VALUES($1,$2,$3,$4)`,
          [plan.id, feature.code, feature.enabled, feature.quota ?? null],
        );
      for (const price of dto.prices)
        await m.query(
          `INSERT INTO whatsapp_core.plan_prices(plan_id,country_code,currency,interval,amount_minor,provider,provider_price_id,tax_behavior,effective_from)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            plan.id,
            price.countryCode ?? null,
            price.currency,
            price.interval,
            price.amountMinor,
            price.provider ?? null,
            price.providerPriceId ?? null,
            price.taxBehavior,
            dto.effectiveFrom,
          ],
        );
      return plan;
    });
  }
  updatePlan(id: string, dto: UpdateAdminPlanDto) {
    return this.dataSource.transaction(
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.subscription_plans SET name=coalesce($2,name),description=CASE WHEN $3 THEN $4 ELSE description END,
           status=coalesce($5,status),display_order=coalesce($6,display_order),effective_to=CASE WHEN $7 THEN $8 ELSE effective_to END,updated_at=now()
           WHERE id=$1 RETURNING *`,
            [
              id,
              dto.name ?? null,
              dto.description !== undefined,
              dto.description ?? null,
              dto.status ?? null,
              dto.displayOrder ?? null,
              dto.effectiveTo !== undefined,
              dto.effectiveTo ?? null,
            ],
          )
        )[0] ?? null,
    );
  }
  adjustment(adminId: string, dto: CreateBillingAdjustmentDto) {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT set_config('app.is_platform_admin','true',true)`);
      return (
        await m.query(
          `INSERT INTO whatsapp_core.billing_adjustments(organization_id,payment_id,type,currency,amount_minor,reason,provider_reference,approved_by_admin_id)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            dto.organizationId,
            dto.paymentId ?? null,
            dto.type,
            dto.currency,
            dto.amountMinor,
            dto.reason,
            dto.providerReference ?? null,
            adminId,
          ],
        )
      )[0];
    });
  }
}
