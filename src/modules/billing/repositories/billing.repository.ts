import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../../database/tenant-context.service";

@Injectable()
export class BillingRepository {
  constructor(private readonly tenants: TenantContextService) {}

  plans(currency?: string, country?: string) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT p.id,p.code,p.version,p.name,p.description,p.trial_days,
              coalesce(jsonb_agg(DISTINCT jsonb_build_object('code',f.code,'enabled',f.enabled,'quota',f.quota)) FILTER (WHERE f.id IS NOT NULL),'[]') features,
              coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',pr.id,'currency',pr.currency,'interval',pr.interval,'amount_minor',pr.amount_minor,'country_code',pr.country_code)) FILTER (WHERE pr.id IS NOT NULL),'[]') prices
         FROM whatsapp_core.subscription_plans p
         LEFT JOIN whatsapp_core.plan_features f ON f.plan_id=p.id
         LEFT JOIN whatsapp_core.plan_prices pr ON pr.plan_id=p.id AND pr.status='ACTIVE' AND now()>=pr.effective_from AND (pr.effective_to IS NULL OR now()<pr.effective_to)
          AND ($1::char(3) IS NULL OR pr.currency=$1) AND ($2::char(2) IS NULL OR pr.country_code IS NULL OR pr.country_code=$2)
        WHERE p.status='ACTIVE' AND now()>=p.effective_from AND (p.effective_to IS NULL OR now()<p.effective_to)
        GROUP BY p.id ORDER BY p.display_order,p.name`,
        [currency ?? null, country ?? null],
      ),
    );
  }

  price(id: string) {
    return this.tenants.runAsPlatformAdmin(
      async (m) =>
        (
          await m.query(
            `SELECT pr.*,p.code plan_code FROM whatsapp_core.plan_prices pr JOIN whatsapp_core.subscription_plans p ON p.id=pr.plan_id
        WHERE pr.id=$1 AND pr.status='ACTIVE' AND p.status='ACTIVE' AND now()>=pr.effective_from AND (pr.effective_to IS NULL OR now()<pr.effective_to)`,
            [id],
          )
        )[0] ?? null,
    );
  }
  recordCheckoutStarted(org: string, user: string, session: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `INSERT INTO whatsapp_core.user_journey_events(organization_id,user_id,session_id,event_type,path)
         VALUES($1,$2,$3,'CHECKOUT_STARTED','/billing/checkout')`,
        [org, user, session],
      ),
    );
  }
  startTrial(org: string, planId: string) {
    return this.tenants.run(org, async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        `trial:${org}`,
      ]);
      const [prior] = await m.query(
        `SELECT id FROM whatsapp_core.subscriptions WHERE organization_id=$1 LIMIT 1`,
        [org],
      );
      if (prior) return null;
      const [subscription] = await m.query(
        `INSERT INTO whatsapp_core.subscriptions
          (organization_id,plan_id,price_id,status,current_period_start,current_period_end,trial_end)
         SELECT $1,p.id,pr.id,'TRIALING',now(),now()+make_interval(days=>p.trial_days),now()+make_interval(days=>p.trial_days)
         FROM whatsapp_core.subscription_plans p
         JOIN LATERAL(SELECT id FROM whatsapp_core.plan_prices WHERE plan_id=p.id AND amount_minor=0 AND status='ACTIVE' ORDER BY effective_from DESC LIMIT 1)pr ON true
         WHERE p.id=$2 AND p.status='ACTIVE' AND p.trial_days>0
         RETURNING *`,
        [org, planId],
      );
      if (subscription)
        await m.query(
          `INSERT INTO whatsapp_core.subscription_events(organization_id,subscription_id,event_type,to_status,metadata)
           VALUES($1,$2,'TRIAL_STARTED','TRIALING','{}'::jsonb)`,
          [org, subscription.id],
        );
      return subscription ?? undefined;
    });
  }

  prices(currency?: string, country?: string) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT pr.*,p.code plan_code,p.name plan_name FROM whatsapp_core.plan_prices pr JOIN whatsapp_core.subscription_plans p ON p.id=pr.plan_id WHERE pr.status='ACTIVE' AND p.status='ACTIVE' AND ($1::char(3) IS NULL OR pr.currency=$1) AND ($2::char(2) IS NULL OR pr.country_code IS NULL OR pr.country_code=$2) AND now()>=pr.effective_from AND (pr.effective_to IS NULL OR now()<pr.effective_to) ORDER BY p.display_order,pr.currency,pr.interval`,
        [currency ?? null, country ?? null],
      ),
    );
  }
  providerSubscription(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT s.*,bc.provider_customer_id,pr.provider_price_id FROM whatsapp_core.subscriptions s LEFT JOIN whatsapp_core.billing_customers bc ON bc.id=s.billing_customer_id JOIN whatsapp_core.plan_prices pr ON pr.id=s.price_id WHERE s.organization_id=$1 ORDER BY s.created_at DESC LIMIT 1`,
            [org],
          )
        )[0] ?? null,
    );
  }

  subscription(org: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT s.*,p.name plan_name,pr.currency,pr.amount_minor,pr.interval FROM whatsapp_core.subscriptions s JOIN whatsapp_core.subscription_plans p ON p.id=s.plan_id JOIN whatsapp_core.plan_prices pr ON pr.id=s.price_id WHERE s.organization_id=$1 ORDER BY s.created_at DESC LIMIT 1`,
            [org],
          )
        )[0] ?? null,
    );
  }
  invoices(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,status,currency,subtotal_minor,tax_minor,total_minor,hosted_url,pdf_url,issued_at,due_at,created_at FROM whatsapp_core.invoices WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  invoice(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT id,status,currency,subtotal_minor,tax_minor,total_minor,hosted_url,pdf_url,issued_at,due_at,created_at FROM whatsapp_core.invoices WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  payments(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,status,currency,amount_minor,refunded_minor,paid_at,created_at FROM whatsapp_core.payments WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  notifications(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,type,payload,status,created_at,sent_at FROM whatsapp_core.billing_notifications
         WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  usage(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT metric_code,sum(quantity)::bigint quantity,min(period_start) period_start,max(period_end) period_end FROM whatsapp_core.usage_records WHERE organization_id=$1 AND period_start<=now() AND period_end>now() GROUP BY metric_code ORDER BY metric_code`,
        [org],
      ),
    );
  }
  history(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,metric_code,quantity,occurred_at,period_start,period_end,resource_type,resource_id FROM whatsapp_core.usage_records WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  quotas(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT f.code,f.quota,coalesce(u.used,0)::bigint used,greatest(f.quota-coalesce(u.used,0),0)::bigint remaining FROM whatsapp_core.subscriptions s JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id LEFT JOIN LATERAL (SELECT sum(quantity) used FROM whatsapp_core.usage_records u WHERE u.organization_id=s.organization_id AND u.metric_code=f.code AND u.period_start<=now() AND u.period_end>now()) u ON true WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE') AND f.quota IS NOT NULL`,
        [org],
      ),
    );
  }
  createReport(
    org: string,
    user: string,
    type: string,
    format: string,
    filters: Record<string, unknown>,
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.report_exports(organization_id,requested_by_user_id,type,format,filters) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id,type,format,status,created_at`,
            [org, user, type, format, JSON.stringify(filters)],
          )
        )[0],
    );
  }
  reports(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,type,format,status,expires_at,created_at,completed_at FROM whatsapp_core.report_exports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  report(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT id,type,format,status,object_key,expires_at,created_at,completed_at FROM whatsapp_core.report_exports WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  pendingReports() {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT id,organization_id FROM whatsapp_core.report_exports WHERE status='PENDING' ORDER BY created_at LIMIT 1000`,
      ),
    );
  }
  expireTrials() {
    return this.tenants.runAsPlatformAdmin(async (m) => {
      const expired = await m.query(
        `UPDATE whatsapp_core.subscriptions SET status='EXPIRED',updated_at=now()
         WHERE status='TRIALING' AND trial_end<=now() RETURNING id,organization_id`,
      );
      for (const subscription of expired) {
        await m.query(
          `INSERT INTO whatsapp_core.subscription_events(organization_id,subscription_id,event_type,from_status,to_status,metadata)
           VALUES($1,$2,'TRIAL_EXPIRED','TRIALING','EXPIRED','{}'::jsonb)`,
          [subscription.organization_id, subscription.id],
        );
        await m.query(
          `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
           VALUES($1,'TRIAL_EXPIRED',jsonb_build_object('subscriptionId',$2))`,
          [subscription.organization_id, subscription.id],
        );
      }
      return expired.length;
    });
  }
  claimReport(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.report_exports SET status='RUNNING'
             WHERE organization_id=$1 AND id=$2 AND status IN ('PENDING','FAILED') RETURNING *`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  finishReport(org: string, id: string, objectKey: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.report_exports SET status='COMPLETED',object_key=$3,completed_at=now(),expires_at=now()+interval '7 days'
         WHERE organization_id=$1 AND id=$2`,
        [org, id, objectKey],
      ),
    );
  }
  failReport(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.report_exports SET status='FAILED' WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }
  reportRows(
    org: string,
    type: string,
    filters: Record<string, unknown>,
    afterId: string | null,
    limit: number,
  ) {
    const common = [
      org,
      (filters.start as string | undefined) ?? null,
      (filters.end as string | undefined) ?? null,
      afterId,
      limit,
    ];
    return this.tenants.run(org, (m) => {
      if (type === "MESSAGES")
        return m.query(
          `SELECT id,campaign_id,sender_id,template_id,status,error_code,created_at,accepted_at,sent_at,delivered_at,read_at
           FROM whatsapp_core.messages WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR created_at>=$2)
             AND ($3::timestamptz IS NULL OR created_at<$3) AND ($4::uuid IS NULL OR id>$4)
             AND ($6::uuid IS NULL OR sender_id=$6) AND ($7::uuid IS NULL OR campaign_id=$7)
             AND ($8::uuid IS NULL OR template_id=$8) AND ($9::varchar IS NULL OR status=$9)
           ORDER BY id LIMIT $5`,
          [
            ...common,
            filters.senderId ?? null,
            filters.campaignId ?? null,
            filters.templateId ?? null,
            filters.status ?? null,
          ],
        );
      if (type === "CAMPAIGN")
        return m.query(
          `SELECT c.id,c.name,c.status,c.created_at,count(r.id)::integer targeted,
             count(r.id) FILTER(WHERE r.eligibility='ELIGIBLE')::integer eligible,
             count(msg.id) FILTER(WHERE msg.status IN ('DELIVERED','READ'))::integer delivered,
             count(msg.id) FILTER(WHERE msg.status='READ')::integer read,
             count(msg.id) FILTER(WHERE msg.status='FAILED')::integer failed
           FROM whatsapp_core.campaigns c LEFT JOIN whatsapp_core.campaign_recipients r ON r.campaign_id=c.id
           LEFT JOIN whatsapp_core.messages msg ON msg.campaign_id=c.id AND msg.contact_id=r.contact_id
           WHERE c.organization_id=$1 AND ($2::timestamptz IS NULL OR c.created_at>=$2)
             AND ($3::timestamptz IS NULL OR c.created_at<$3) AND ($4::uuid IS NULL OR c.id>$4)
             AND ($6::uuid IS NULL OR c.id=$6) AND ($7::varchar IS NULL OR c.status=$7)
           GROUP BY c.id ORDER BY c.id LIMIT $5`,
          [...common, filters.campaignId ?? null, filters.status ?? null],
        );
      if (type === "TEMPLATES")
        return m.query(
          `SELECT t.id,t.name,t.language,t.category,count(msg.id)::integer usage_count,
             count(msg.id) FILTER(WHERE msg.status IN ('DELIVERED','READ'))::integer delivered,
             count(msg.id) FILTER(WHERE msg.status='READ')::integer read,count(msg.id) FILTER(WHERE msg.status='FAILED')::integer failed
           FROM whatsapp_core.message_templates t LEFT JOIN whatsapp_core.messages msg ON msg.template_id=t.id
             AND ($2::timestamptz IS NULL OR msg.created_at>=$2) AND ($3::timestamptz IS NULL OR msg.created_at<$3)
           WHERE t.organization_id=$1 AND ($4::uuid IS NULL OR t.id>$4) AND ($6::uuid IS NULL OR t.id=$6)
           GROUP BY t.id ORDER BY t.id LIMIT $5`,
          [...common, filters.templateId ?? null],
        );
      if (type === "USAGE")
        return m.query(
          `SELECT id,metric_code,quantity,resource_type,resource_id,period_start,period_end,occurred_at
           FROM whatsapp_core.usage_records WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR occurred_at>=$2)
             AND ($3::timestamptz IS NULL OR occurred_at<$3) AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5`,
          common,
        );
      if (type === "PAYMENTS")
        return m.query(
          `SELECT id,status,currency,amount_minor,refunded_minor,paid_at,created_at
           FROM whatsapp_core.payments WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR created_at>=$2)
             AND ($3::timestamptz IS NULL OR created_at<$3) AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5`,
          common,
        );
      return m.query(
        `SELECT id,status,currency,subtotal_minor,tax_minor,total_minor,invoice_number,issued_at,due_at,created_at
         FROM whatsapp_core.invoices WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR created_at>=$2)
           AND ($3::timestamptz IS NULL OR created_at<$3) AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5`,
        common,
      );
    });
  }

  storeWebhook(
    provider: string,
    eventId: string,
    type: string,
    payload: unknown,
  ): Promise<boolean> {
    return this.tenants.runAsPlatformAdmin(async (m) => {
      const r = await m.query(
        `INSERT INTO whatsapp_core.payment_webhook_events(provider,provider_event_id,event_type,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
        [provider, eventId, type, JSON.stringify(payload)],
      );
      if (r.length === 1) return true;
      const existing = await m.query(
        `SELECT status FROM whatsapp_core.payment_webhook_events WHERE provider=$1 AND provider_event_id=$2`,
        [provider, eventId],
      );
      return (
        existing[0]?.status === "PENDING" || existing[0]?.status === "FAILED"
      );
    });
  }

  applyStripeEvent(eventId: string, type: string, object: any): Promise<void> {
    return this.tenants.runAsPlatformAdmin(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        eventId,
      ]);
      if (type === "checkout.session.completed") {
        const org = object.client_reference_id;
        const price = object.metadata?.price_id;
        if (org && price && object.customer && object.subscription) {
          const customer = (
            await m.query(
              `INSERT INTO whatsapp_core.billing_customers(organization_id,provider,provider_customer_id) VALUES($1,'STRIPE',$2) ON CONFLICT(organization_id,provider) DO UPDATE SET provider_customer_id=excluded.provider_customer_id,updated_at=now() RETURNING id`,
              [org, object.customer],
            )
          )[0];
          await m.query(
            `INSERT INTO whatsapp_core.subscriptions(organization_id,plan_id,price_id,billing_customer_id,provider,provider_subscription_id,status,raw_provider_status) SELECT $1,plan_id,id,$3,'STRIPE',$4,'INCOMPLETE','checkout_completed' FROM whatsapp_core.plan_prices WHERE id=$2 ON CONFLICT(provider,provider_subscription_id) DO NOTHING`,
            [org, price, customer.id, object.subscription],
          );
        }
      } else if (type.startsWith("customer.subscription.")) {
        const status: Record<string, string> = {
          trialing: "TRIALING",
          active: "ACTIVE",
          past_due: "PAST_DUE",
          paused: "PAUSED",
          canceled: "CANCELLED",
          incomplete: "INCOMPLETE",
          incomplete_expired: "EXPIRED",
          unpaid: "PAST_DUE",
        };
        const org = object.metadata?.organization_id;
        const price = object.metadata?.price_id;
        if (org && price && object.customer) {
          const customer = (
            await m.query(
              `INSERT INTO whatsapp_core.billing_customers(organization_id,provider,provider_customer_id) VALUES($1,'STRIPE',$2) ON CONFLICT(organization_id,provider) DO UPDATE SET provider_customer_id=excluded.provider_customer_id,updated_at=now() RETURNING id`,
              [org, object.customer],
            )
          )[0];
          await m.query(
            `INSERT INTO whatsapp_core.subscriptions(organization_id,plan_id,price_id,billing_customer_id,provider,provider_subscription_id,status,raw_provider_status) SELECT $1,plan_id,id,$3,'STRIPE',$4,$5,$6 FROM whatsapp_core.plan_prices WHERE id=$2 ON CONFLICT(provider,provider_subscription_id) DO NOTHING`,
            [
              org,
              price,
              customer.id,
              object.id,
              status[object.status] ?? "INCOMPLETE",
              object.status,
            ],
          );
        }
        const before = (
          await m.query(
            `SELECT id,organization_id,status FROM whatsapp_core.subscriptions WHERE provider='STRIPE' AND provider_subscription_id=$1 FOR UPDATE`,
            [object.id],
          )
        )[0];
        const updated = (
          await m.query(
            `UPDATE whatsapp_core.subscriptions SET status=$2,raw_provider_status=$3,current_period_start=to_timestamp($4),current_period_end=to_timestamp($5),cancel_at_period_end=$6,cancelled_at=CASE WHEN $2='CANCELLED' THEN now() ELSE cancelled_at END,updated_at=now() WHERE provider='STRIPE' AND provider_subscription_id=$1 RETURNING id,organization_id,status`,
            [
              object.id,
              status[object.status] ?? "INCOMPLETE",
              object.status,
              object.current_period_start,
              object.current_period_end,
              Boolean(object.cancel_at_period_end),
            ],
          )
        )[0];
        if (updated) {
          await m.query(
            `INSERT INTO whatsapp_core.subscription_events(organization_id,subscription_id,event_type,from_status,to_status,provider_event_id,metadata)
             VALUES($1,$2,$3,$4,$5,$6,jsonb_build_object('rawStatus',$7)) ON CONFLICT(provider_event_id) DO NOTHING`,
            [
              updated.organization_id,
              updated.id,
              type,
              before?.status ?? null,
              updated.status,
              eventId,
              object.status,
            ],
          );
          await m.query(
            `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload) VALUES($1,'SUBSCRIPTION_STATUS_CHANGED',jsonb_build_object('subscriptionId',$2,'status',$3))`,
            [updated.organization_id, updated.id, updated.status],
          );
        }
      } else if (type.startsWith("invoice.")) {
        const subscription = (
          await m.query(
            `SELECT id,organization_id FROM whatsapp_core.subscriptions
             WHERE provider='STRIPE' AND provider_subscription_id=$1`,
            [object.subscription],
          )
        )[0];
        if (subscription) {
          const invoiceStatus = String(
            object.status ?? type.split(".")[1],
          ).toUpperCase();
          await m.query(
            `INSERT INTO whatsapp_core.invoices
              (organization_id,subscription_id,provider,provider_invoice_id,invoice_number,status,currency,subtotal_minor,tax_minor,total_minor,hosted_url,pdf_url,issued_at,due_at)
             VALUES($1,$2,'STRIPE',$3,$4,$5,upper($6),$7,$8,$9,$10,$11,to_timestamp($12),CASE WHEN $13::bigint IS NULL THEN NULL ELSE to_timestamp($13) END)
             ON CONFLICT(provider,provider_invoice_id) DO UPDATE SET invoice_number=excluded.invoice_number,status=excluded.status,
               subtotal_minor=excluded.subtotal_minor,tax_minor=excluded.tax_minor,total_minor=excluded.total_minor,
               hosted_url=excluded.hosted_url,pdf_url=excluded.pdf_url,issued_at=excluded.issued_at,due_at=excluded.due_at`,
            [
              subscription.organization_id,
              subscription.id,
              object.id,
              object.number ?? null,
              invoiceStatus,
              object.currency,
              Number(object.subtotal ?? 0),
              Number(object.tax ?? 0),
              Number(object.total ?? object.amount_due ?? 0),
              object.hosted_invoice_url ?? null,
              object.invoice_pdf ?? null,
              object.created ?? Math.floor(Date.now() / 1000),
              object.due_date ?? null,
            ],
          );
          if (
            object.payment_intent &&
            ["invoice.paid", "invoice.payment_failed"].includes(type)
          ) {
            const paymentStatus = type === "invoice.paid" ? "PAID" : "FAILED";
            await m.query(
              `INSERT INTO whatsapp_core.payments
                (organization_id,subscription_id,provider,provider_payment_id,status,currency,amount_minor,paid_at)
               VALUES($1,$2,'STRIPE',$3,$4,upper($5),$6,CASE WHEN $4='PAID' THEN coalesce(to_timestamp($7),now()) END)
               ON CONFLICT(provider,provider_payment_id) DO UPDATE SET status=excluded.status,amount_minor=excluded.amount_minor,paid_at=excluded.paid_at`,
              [
                subscription.organization_id,
                subscription.id,
                object.payment_intent,
                paymentStatus,
                object.currency,
                Number(object.amount_paid ?? object.amount_due ?? 0),
                object.status_transitions?.paid_at ?? null,
              ],
            );
          }
          await m.query(
            `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
             VALUES($1,$2,jsonb_build_object('invoiceId',$3,'status',$4))`,
            [
              subscription.organization_id,
              type === "invoice.paid" ? "PAYMENT_SUCCEEDED" : "INVOICE_UPDATED",
              object.id,
              invoiceStatus,
            ],
          );
        }
      } else if (type === "charge.refunded" && object.payment_intent) {
        const [payment] = await m.query(
          `UPDATE whatsapp_core.payments SET refunded_minor=least(amount_minor,$2),status=CASE WHEN $2>=amount_minor THEN 'REFUNDED' ELSE status END
           WHERE provider='STRIPE' AND provider_payment_id=$1 RETURNING organization_id,id,refunded_minor,status`,
          [object.payment_intent, Number(object.amount_refunded ?? 0)],
        );
        if (payment)
          await m.query(
            `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
             VALUES($1,'PAYMENT_REFUNDED',jsonb_build_object('paymentId',$2,'amountMinor',$3))`,
            [payment.organization_id, payment.id, payment.refunded_minor],
          );
      }
      await m.query(
        `UPDATE whatsapp_core.payment_webhook_events SET status='PROCESSED',processed_at=now() WHERE provider='STRIPE' AND provider_event_id=$1`,
        [eventId],
      );
    });
  }

  applyRazorpayEvent(
    eventId: string,
    type: string,
    payload: any,
  ): Promise<void> {
    return this.tenants.runAsPlatformAdmin(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        eventId,
      ]);
      const object = payload.subscription;
      const statuses: Record<string, string> = {
        created: "INCOMPLETE",
        authenticated: "INCOMPLETE",
        active: "ACTIVE",
        pending: "PAST_DUE",
        halted: "PAST_DUE",
        paused: "PAUSED",
        cancelled: "CANCELLED",
        completed: "EXPIRED",
        expired: "EXPIRED",
      };
      let subscription: any = null;
      if (object?.id) {
        const org = object.notes?.organization_id;
        const priceId = object.notes?.price_id;
        let customerId: string | null = null;
        if (org && object.customer_id) {
          customerId = (
            await m.query(
              `INSERT INTO whatsapp_core.billing_customers(organization_id,provider,provider_customer_id)
               VALUES($1,'RAZORPAY',$2)
               ON CONFLICT(organization_id,provider) DO UPDATE SET provider_customer_id=excluded.provider_customer_id,updated_at=now()
               RETURNING id`,
              [org, object.customer_id],
            )
          )[0].id;
        }
        const existing = (
          await m.query(
            `SELECT id,organization_id,status FROM whatsapp_core.subscriptions
             WHERE provider='RAZORPAY' AND provider_subscription_id=$1 FOR UPDATE`,
            [object.id],
          )
        )[0];
        if (!existing && org && priceId) {
          const current = (
            await m.query(
              `SELECT id,status FROM whatsapp_core.subscriptions
               WHERE organization_id=$1 AND status IN ('TRIALING','ACTIVE','PAST_DUE','PAUSED','INCOMPLETE')
               ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
              [org],
            )
          )[0];
          if (current) {
            await m.query(
              `UPDATE whatsapp_core.subscriptions SET
                 plan_id=(SELECT plan_id FROM whatsapp_core.plan_prices WHERE id=$2),price_id=$2,
                 billing_customer_id=$3,provider='RAZORPAY',provider_subscription_id=$4,updated_at=now()
               WHERE id=$1`,
              [current.id, priceId, customerId, object.id],
            );
          } else {
            await m.query(
              `INSERT INTO whatsapp_core.subscriptions
                 (organization_id,plan_id,price_id,billing_customer_id,provider,provider_subscription_id,status,raw_provider_status)
               SELECT $1,plan_id,id,$3,'RAZORPAY',$4,'INCOMPLETE','created'
               FROM whatsapp_core.plan_prices WHERE id=$2
               ON CONFLICT(provider,provider_subscription_id) DO NOTHING`,
              [org, priceId, customerId, object.id],
            );
          }
        }
        const before = (
          await m.query(
            `SELECT id,organization_id,status FROM whatsapp_core.subscriptions
             WHERE provider='RAZORPAY' AND provider_subscription_id=$1 FOR UPDATE`,
            [object.id],
          )
        )[0];
        const incoming = statuses[object.status] ?? "INCOMPLETE";
        subscription = (
          await m.query(
            `UPDATE whatsapp_core.subscriptions SET
               status=CASE WHEN status IN ('CANCELLED','EXPIRED') AND $2 NOT IN ('CANCELLED','EXPIRED') THEN status ELSE $2 END,
               raw_provider_status=$3,
               current_period_start=CASE WHEN $4::bigint IS NULL THEN current_period_start ELSE to_timestamp($4) END,
               current_period_end=CASE WHEN $5::bigint IS NULL THEN current_period_end ELSE to_timestamp($5) END,
               cancel_at_period_end=coalesce($6,false),
               cancelled_at=CASE WHEN $2='CANCELLED' THEN coalesce(cancelled_at,now()) ELSE cancelled_at END,
               updated_at=now()
             WHERE provider='RAZORPAY' AND provider_subscription_id=$1
             RETURNING id,organization_id,status`,
            [
              object.id,
              incoming,
              object.status,
              object.current_start ?? null,
              object.current_end ?? null,
              object.has_scheduled_changes ?? false,
            ],
          )
        )[0];
        if (subscription) {
          await m.query(
            `INSERT INTO whatsapp_core.subscription_events
               (organization_id,subscription_id,event_type,from_status,to_status,provider_event_id,metadata)
             VALUES($1,$2,$3,$4,$5,$6,jsonb_build_object('rawStatus',$7))
             ON CONFLICT(provider_event_id) DO NOTHING`,
            [
              subscription.organization_id,
              subscription.id,
              type,
              before?.status ?? null,
              subscription.status,
              eventId,
              object.status,
            ],
          );
          await m.query(
            `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
             VALUES($1,'SUBSCRIPTION_STATUS_CHANGED',jsonb_build_object('subscriptionId',$2,'status',$3))`,
            [
              subscription.organization_id,
              subscription.id,
              subscription.status,
            ],
          );
        }
      }
      const payment = payload.payment;
      if (payment?.id && subscription) {
        const paymentStatus =
          payment.status === "captured"
            ? "PAID"
            : payment.status === "failed"
              ? "FAILED"
              : String(payment.status ?? "PENDING").toUpperCase();
        await m.query(
          `INSERT INTO whatsapp_core.payments
             (organization_id,subscription_id,provider,provider_payment_id,status,currency,amount_minor,refunded_minor,paid_at)
           VALUES($1,$2,'RAZORPAY',$3,$4,upper($5),$6,$7,CASE WHEN $4='PAID' THEN to_timestamp($8) END)
           ON CONFLICT(provider,provider_payment_id) DO UPDATE SET
             status=excluded.status,amount_minor=excluded.amount_minor,refunded_minor=excluded.refunded_minor,paid_at=excluded.paid_at`,
          [
            subscription.organization_id,
            subscription.id,
            payment.id,
            paymentStatus,
            payment.currency,
            Number(payment.amount ?? 0),
            Number(payment.amount_refunded ?? 0),
            payment.created_at ?? Math.floor(Date.now() / 1000),
          ],
        );
        if (paymentStatus === "PAID")
          await m.query(
            `INSERT INTO whatsapp_core.billing_notifications(organization_id,type,payload)
             VALUES($1,'PAYMENT_SUCCEEDED',jsonb_build_object('providerPaymentId',$2))`,
            [subscription.organization_id, payment.id],
          );
      }
      await m.query(
        `UPDATE whatsapp_core.payment_webhook_events SET status='PROCESSED',processed_at=now()
         WHERE provider='RAZORPAY' AND provider_event_id=$1`,
        [eventId],
      );
    });
  }
}
