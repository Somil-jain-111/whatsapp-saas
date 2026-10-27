import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import { AnalyticsQueryDto, JourneyEventDto } from "./dto/analytics-query.dto";

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly tenants: TenantContextService) {}
  private params(org: string, q: AnalyticsQueryDto) {
    return [
      org,
      q.start ?? null,
      q.end ?? null,
      q.senderId ?? null,
      q.campaignId ?? null,
      q.templateId ?? null,
    ];
  }
  recordJourney(
    org: string,
    user: string,
    session: string,
    dto: JourneyEventDto,
  ) {
    return this.tenants.run(org, async (m) => {
      const key = `${org}:${user}:${session}:${dto.eventType}:${dto.path}`;
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        key,
      ]);
      return m.query(
        `INSERT INTO whatsapp_core.user_journey_events(organization_id,user_id,session_id,event_type,path)
         SELECT $1::uuid,$2::uuid,$3::uuid,$4::varchar,$5::varchar
         WHERE NOT EXISTS (
           SELECT 1 FROM whatsapp_core.user_journey_events
           WHERE organization_id=$1::uuid AND user_id=$2::uuid AND session_id=$3::uuid
             AND event_type=$4::varchar AND path=$5::varchar
             AND created_at>=now()-interval '5 seconds'
         ) RETURNING id,event_type,path,created_at`,
        [org, user, session, dto.eventType, dto.path],
      );
    });
  }
  overview(org: string, q: AnalyticsQueryDto) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT count(*)::integer total,
    count(*) FILTER(WHERE status='QUEUED')::integer queued,
    count(*) FILTER(WHERE status IN('ACCEPTED','SENT','DELIVERED','READ'))::integer accepted,
    count(*) FILTER(WHERE status IN('SENT','DELIVERED','READ'))::integer sent,
    count(*) FILTER(WHERE status IN('DELIVERED','READ'))::integer delivered,count(*) FILTER(WHERE status='READ')::integer read,
    count(*) FILTER(WHERE status='FAILED')::integer failed,count(*) FILTER(WHERE status='CANCELLED')::integer cancelled,
    round(100.0*count(*) FILTER(WHERE status IN('DELIVERED','READ'))/nullif(count(*) FILTER(WHERE status IN('SENT','DELIVERED','READ')),0),2) delivery_rate,
    round(100.0*count(*) FILTER(WHERE status='READ')/nullif(count(*) FILTER(WHERE status IN('DELIVERED','READ')),0),2) read_rate,
    round(100.0*count(*) FILTER(WHERE status='FAILED')/nullif(count(*) FILTER(WHERE status IN('ACCEPTED','SENT','DELIVERED','READ','FAILED')),0),2) failure_rate
    FROM whatsapp_core.messages WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR created_at >= $2) AND ($3::timestamptz IS NULL OR created_at < $3) AND ($4::uuid IS NULL OR sender_id=$4) AND ($5::uuid IS NULL OR campaign_id=$5) AND ($6::uuid IS NULL OR template_id=$6)`,
            this.params(org, q),
          )
        )[0],
    );
  }
  campaigns(org: string, q: AnalyticsQueryDto) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT c.id,c.name,c.status,count(msg.id)::integer total,count(msg.id) FILTER(WHERE msg.status IN('DELIVERED','READ'))::integer delivered,count(msg.id) FILTER(WHERE msg.status='READ')::integer read,count(msg.id) FILTER(WHERE msg.status='FAILED')::integer failed FROM whatsapp_core.campaigns c LEFT JOIN whatsapp_core.messages msg ON msg.campaign_id=c.id WHERE c.organization_id=$1 AND ($2::timestamptz IS NULL OR c.created_at >= $2) AND ($3::timestamptz IS NULL OR c.created_at < $3) GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100`,
        [org, q.start ?? null, q.end ?? null],
      ),
    );
  }
  campaign(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT c.id,c.name,c.status,count(r.id)::integer targeted,
              count(r.id) FILTER(WHERE r.eligibility='ELIGIBLE')::integer eligible,count(r.id) FILTER(WHERE r.eligibility='SUPPRESSED')::integer suppressed,
              count(msg.id) FILTER(WHERE msg.status='QUEUED')::integer queued,count(msg.id) FILTER(WHERE msg.status IN('ACCEPTED','SENT','DELIVERED','READ'))::integer accepted,
              count(msg.id) FILTER(WHERE msg.status IN('SENT','DELIVERED','READ'))::integer sent,count(msg.id) FILTER(WHERE msg.status IN('DELIVERED','READ'))::integer delivered,
              count(msg.id) FILTER(WHERE msg.status='READ')::integer read,count(msg.id) FILTER(WHERE msg.status='FAILED')::integer failed,
              count(msg.id) FILTER(WHERE msg.status='CANCELLED')::integer cancelled,
              round(100.0*count(msg.id) FILTER(WHERE msg.status IN('DELIVERED','READ'))/nullif(count(msg.id) FILTER(WHERE msg.status IN('SENT','DELIVERED','READ')),0),2) delivery_rate,
              round(100.0*count(msg.id) FILTER(WHERE msg.status='READ')/nullif(count(msg.id) FILTER(WHERE msg.status IN('DELIVERED','READ')),0),2) read_rate,
              round(100.0*count(msg.id) FILTER(WHERE msg.status='FAILED')/nullif(count(msg.id) FILTER(WHERE msg.status IN('ACCEPTED','SENT','DELIVERED','READ','FAILED')),0),2) failure_rate
             FROM whatsapp_core.campaigns c LEFT JOIN whatsapp_core.campaign_recipients r ON r.campaign_id=c.id LEFT JOIN whatsapp_core.messages msg ON msg.campaign_id=c.id AND msg.contact_id=r.contact_id WHERE c.organization_id=$1 AND c.id=$2 GROUP BY c.id`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  templates(org: string, q: AnalyticsQueryDto) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT t.id,t.name,t.language,t.category,count(msg.id)::integer usage_count,
          count(msg.id) FILTER(WHERE msg.status IN('ACCEPTED','SENT','DELIVERED','READ'))::integer accepted,
          count(msg.id) FILTER(WHERE msg.status IN('DELIVERED','READ'))::integer delivered,count(msg.id) FILTER(WHERE msg.status='READ')::integer read,
          count(msg.id) FILTER(WHERE msg.status='FAILED')::integer failed,
          coalesce((SELECT jsonb_object_agg(x.error_code,x.count) FROM (SELECT coalesce(m2.error_code,'UNKNOWN') error_code,count(*)::integer count FROM whatsapp_core.messages m2 WHERE m2.organization_id=$1 AND m2.template_id=t.id AND m2.status='FAILED' AND ($2::timestamptz IS NULL OR m2.created_at >= $2) AND ($3::timestamptz IS NULL OR m2.created_at < $3) GROUP BY coalesce(m2.error_code,'UNKNOWN'))x),'{}') failure_reasons
         FROM whatsapp_core.message_templates t LEFT JOIN whatsapp_core.messages msg ON msg.template_id=t.id AND ($2::timestamptz IS NULL OR msg.created_at >= $2) AND ($3::timestamptz IS NULL OR msg.created_at < $3) WHERE t.organization_id=$1 GROUP BY t.id ORDER BY usage_count DESC LIMIT 100`,
        [org, q.start ?? null, q.end ?? null],
      ),
    );
  }
  messages(org: string, q: AnalyticsQueryDto) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,campaign_id,sender_id,template_id,status,raw_provider_status,error_code,created_at,accepted_at,sent_at,delivered_at,read_at FROM whatsapp_core.messages WHERE organization_id=$1 AND ($2::timestamptz IS NULL OR created_at >= $2) AND ($3::timestamptz IS NULL OR created_at < $3) AND ($4::uuid IS NULL OR sender_id=$4) AND ($5::uuid IS NULL OR campaign_id=$5) AND ($6::uuid IS NULL OR template_id=$6) ORDER BY created_at DESC LIMIT 500`,
        this.params(org, q),
      ),
    );
  }
  costs(org: string, q: AnalyticsQueryDto) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT msg.id,msg.status,t.category,c.country_code,p.currency,p.amount_minor,CASE WHEN p.id IS NULL THEN 'UNAVAILABLE' ELSE 'ESTIMATED' END cost_status FROM whatsapp_core.messages msg JOIN whatsapp_core.message_templates t ON t.id=msg.template_id LEFT JOIN whatsapp_core.contacts c ON c.id=msg.contact_id LEFT JOIN LATERAL(SELECT * FROM whatsapp_core.messaging_price_versions p WHERE p.country_code=c.country_code AND p.category=t.category AND p.effective_from<=msg.created_at AND (p.effective_to IS NULL OR p.effective_to>msg.created_at) ORDER BY p.effective_from DESC LIMIT 1)p ON true WHERE msg.organization_id=$1 AND ($2::timestamptz IS NULL OR msg.created_at >= $2) AND ($3::timestamptz IS NULL OR msg.created_at < $3) ORDER BY msg.created_at DESC LIMIT 500`,
        [org, q.start ?? null, q.end ?? null],
      ),
    );
  }
}
