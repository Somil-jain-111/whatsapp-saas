import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { TenantContextService } from "../../database/tenant-context.service";

@Injectable()
export class EntitlementService {
  constructor(private readonly tenants: TenantContextService) {}

  async canUseFeature(organizationId: string, featureCode: string) {
    return this.tenants.run(organizationId, async (manager) => {
      const [feature] = await manager.query(
        `SELECT f.enabled FROM whatsapp_core.subscriptions s
         JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id
         WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE') AND f.code=$2
         ORDER BY s.created_at DESC LIMIT 1`,
        [organizationId, featureCode],
      );
      return Boolean(feature?.enabled);
    });
  }

  async getRemainingQuota(organizationId: string, metricCode: string) {
    return this.tenants.run(organizationId, async (manager) => {
      const [row] = await manager.query(
        `SELECT f.enabled,f.quota,s.current_period_start,s.current_period_end,
          coalesce((SELECT sum(quantity) FROM whatsapp_core.usage_records u
            WHERE u.organization_id=s.organization_id AND u.metric_code=$2
              AND u.period_start=s.current_period_start AND u.period_end=s.current_period_end),0)::bigint used,
          coalesce((SELECT sum(quantity) FROM whatsapp_core.quota_reservations q
            WHERE q.organization_id=s.organization_id AND q.metric_code=$2
              AND q.period_start=s.current_period_start AND q.period_end=s.current_period_end
              AND q.status='RESERVED' AND q.expires_at>now()),0)::bigint reserved
         FROM whatsapp_core.subscriptions s
         JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code=$2
         WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE')
           AND s.current_period_start IS NOT NULL AND s.current_period_end>now()
         ORDER BY s.created_at DESC LIMIT 1`,
        [organizationId, metricCode],
      );
      if (!row || !row.enabled) return 0;
      if (row.quota === null) return null;
      return Math.max(
        Number(row.quota) - Number(row.used) - Number(row.reserved),
        0,
      );
    });
  }

  async reserveQuota(
    organizationId: string,
    metricCode: string,
    amount: number,
    idempotencyKey: string = randomUUID(),
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new ConflictException("Quota amount must be a positive integer");
    return this.tenants.run(organizationId, async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2,0))`,
        [organizationId, metricCode],
      );
      const [existing] = await manager.query(
        `SELECT id,quantity,status FROM whatsapp_core.quota_reservations
         WHERE organization_id=$1 AND metric_code=$2 AND idempotency_key=$3`,
        [organizationId, metricCode, idempotencyKey],
      );
      if (existing) {
        if (Number(existing.quantity) !== amount)
          throw new ConflictException("Idempotency key was already used");
        return existing;
      }
      const [feature] = await manager.query(
        `SELECT f.enabled,f.quota,s.current_period_start,s.current_period_end,
          coalesce((SELECT sum(quantity) FROM whatsapp_core.usage_records u
            WHERE u.organization_id=s.organization_id AND u.metric_code=$2
              AND u.period_start=s.current_period_start AND u.period_end=s.current_period_end),0)::bigint used,
          coalesce((SELECT sum(quantity) FROM whatsapp_core.quota_reservations q
            WHERE q.organization_id=s.organization_id AND q.metric_code=$2
              AND q.period_start=s.current_period_start AND q.period_end=s.current_period_end
              AND q.status='RESERVED' AND q.expires_at>now()),0)::bigint reserved
         FROM whatsapp_core.subscriptions s
         JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code=$2
         WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE')
           AND s.current_period_start IS NOT NULL AND s.current_period_end>now()
         ORDER BY s.created_at DESC LIMIT 1`,
        [organizationId, metricCode],
      );
      if (!feature || !feature.enabled)
        throw new NotFoundException("Active entitlement not found");
      if (
        feature.quota !== null &&
        Number(feature.used) + Number(feature.reserved) + amount >
          Number(feature.quota)
      )
        throw new ConflictException("Quota exceeded");
      const [reservation] = await manager.query(
        `INSERT INTO whatsapp_core.quota_reservations
          (organization_id,metric_code,quantity,idempotency_key,period_start,period_end,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,least($6,now()+interval '15 minutes'))
         RETURNING id,quantity,status,expires_at`,
        [
          organizationId,
          metricCode,
          amount,
          idempotencyKey,
          feature.current_period_start,
          feature.current_period_end,
        ],
      );
      return reservation;
    });
  }

  commitQuota(organizationId: string, reservationId: string) {
    return this.tenants.run(organizationId, async (manager) => {
      const [reservation] = await manager.query(
        `SELECT * FROM whatsapp_core.quota_reservations
         WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [organizationId, reservationId],
      );
      if (!reservation)
        throw new NotFoundException("Quota reservation not found");
      if (reservation.status === "COMMITTED") return reservation;
      if (
        reservation.status !== "RESERVED" ||
        new Date(reservation.expires_at) <= new Date()
      )
        throw new ConflictException("Quota reservation is no longer active");
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2,0))`,
        [organizationId, reservation.metric_code],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.usage_records
          (organization_id,metric_code,quantity,source_event_id,resource_type,resource_id,period_start,period_end,occurred_at)
         VALUES($1,$2,$3,$4::varchar,'QUOTA_RESERVATION',$4::uuid,$5,$6,now())
         ON CONFLICT(organization_id,metric_code,source_event_id) DO NOTHING`,
        [
          organizationId,
          reservation.metric_code,
          reservation.quantity,
          reservation.id,
          reservation.period_start,
          reservation.period_end,
        ],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.usage_aggregates(organization_id,metric_code,period_start,period_end,quantity)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(organization_id,metric_code,period_start,period_end)
         DO UPDATE SET quantity=whatsapp_core.usage_aggregates.quantity+excluded.quantity,updated_at=now()`,
        [
          organizationId,
          reservation.metric_code,
          reservation.period_start,
          reservation.period_end,
          reservation.quantity,
        ],
      );
      await manager.query(
        `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
         SELECT $1,'QUOTA_WARNING',jsonb_build_object('metricCode',$2::varchar,'periodEnd',$4::timestamptz,'used',a.quantity,'quota',f.quota)
         FROM whatsapp_core.usage_aggregates a
         JOIN whatsapp_core.subscriptions s ON s.organization_id=a.organization_id AND s.status IN ('TRIALING','ACTIVE','PAST_DUE')
         JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code=a.metric_code
         WHERE a.organization_id=$1 AND a.metric_code=$2 AND a.period_start=$3 AND a.period_end=$4
           AND f.quota IS NOT NULL AND a.quantity*100>=f.quota*80
           AND NOT EXISTS(SELECT 1 FROM whatsapp_core.billing_notifications n WHERE n.organization_id=$1 AND n.type='QUOTA_WARNING' AND n.payload->>'metricCode'=$2::varchar AND (n.payload->>'periodEnd')::timestamptz=$4::timestamptz)`,
        [
          organizationId,
          reservation.metric_code,
          reservation.period_start,
          reservation.period_end,
        ],
      );
      return (
        await manager.query(
          `UPDATE whatsapp_core.quota_reservations SET status='COMMITTED',committed_at=now()
           WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [organizationId, reservationId],
        )
      )[0];
    });
  }

  releaseQuota(organizationId: string, reservationId: string) {
    return this.tenants.run(
      organizationId,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.quota_reservations SET status='RELEASED',released_at=now()
           WHERE organization_id=$1 AND id=$2 AND status='RESERVED' RETURNING *`,
            [organizationId, reservationId],
          )
        )[0] ?? null,
    );
  }
}
