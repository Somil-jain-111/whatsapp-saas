import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import { CampaignListDto, CreateCampaignDto } from "./dto/campaign.dto";

@Injectable()
export class CampaignsRepository {
  constructor(private readonly tenants: TenantContextService) {}
  create(org: string, user: string, dto: CreateCampaignDto) {
    return this.tenants.run(org, async (m) => {
      const campaign = (
        await m.query(
          `INSERT INTO whatsapp_core.campaigns(organization_id,name,description,sender_id,template_id,segment_id,scheduled_at,timezone,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            org,
            dto.name.trim(),
            dto.description?.trim() ?? null,
            dto.senderId,
            dto.templateId,
            dto.segmentId ?? null,
            dto.scheduledAt ?? null,
            dto.timezone,
            user,
          ],
        )
      )[0];
      for (let i = 0; i < dto.recipients.length; i += 500) {
        const batch = dto.recipients.slice(i, i + 500);
        await m.query(
          `INSERT INTO whatsapp_core.campaign_recipients(organization_id,campaign_id,contact_id,parameters) SELECT $1,$2,x.contact_id,x.parameters FROM jsonb_to_recordset($3::jsonb) AS x(contact_id uuid,parameters jsonb) ON CONFLICT(campaign_id,contact_id) DO NOTHING`,
          [
            org,
            campaign.id,
            JSON.stringify(
              batch.map((r) => ({
                contact_id: r.contactId,
                parameters: r.parameters,
              })),
            ),
          ],
        );
      }
      return campaign;
    });
  }
  list(org: string, dto: CampaignListDto) {
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT c.*,count(*) OVER()::integer total,(SELECT count(*)::integer FROM whatsapp_core.campaign_recipients r WHERE r.campaign_id=c.id) recipient_count FROM whatsapp_core.campaigns c WHERE organization_id=$1 AND ($2::varchar IS NULL OR status=$2) ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
        [org, dto.status ?? null, dto.limit, (dto.page - 1) * dto.limit],
      );
      return {
        items: rows.map(({ total: _total, ...x }: any) => x),
        total: rows[0]?.total ?? 0,
        page: dto.page,
        limit: dto.limit,
      };
    });
  }
  get(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT * FROM whatsapp_core.campaigns WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  transition(org: string, id: string, from: string[], to: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.campaigns SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status=ANY($4::varchar[]) RETURNING *`,
            [org, id, to, from],
          )
        )[0] ?? null,
    );
  }
  schedule(org: string, id: string, scheduledAt: Date) {
    return this.tenants.run(org, (m) =>
      m.query(
        `INSERT INTO whatsapp_core.campaign_schedules(organization_id,campaign_id,scheduled_at)
         VALUES($1,$2,$3) ON CONFLICT(campaign_id) DO UPDATE
         SET scheduled_at=excluded.scheduled_at,status='PENDING',lease_until=NULL`,
        [org, id, scheduledAt],
      ),
    );
  }
  cancelSchedule(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.campaign_schedules SET status='CANCELLED',lease_until=NULL
         WHERE organization_id=$1 AND campaign_id=$2 AND status IN ('PENDING','CLAIMED')`,
        [org, id],
      ),
    );
  }
  async validate(org: string, id: string) {
    return this.tenants.run(org, async (m) => {
      const [result] = await m.query(
        `SELECT c.id,c.status,t.meta_status,p.status sender_status,count(r.id)::integer recipients,
      count(r.id) FILTER(WHERE ct.status='SUPPRESSED' OR coalesce((SELECT cc.status FROM whatsapp_core.contact_consents cc WHERE cc.contact_id=ct.id AND cc.purpose='MARKETING' ORDER BY cc.created_at DESC LIMIT 1),'OPTED_OUT')<>'OPTED_IN')::integer suppressed
      FROM whatsapp_core.campaigns c JOIN whatsapp_core.message_templates t ON t.id=c.template_id JOIN whatsapp_core.whatsapp_phone_numbers p ON p.id=c.sender_id
      LEFT JOIN whatsapp_core.campaign_recipients r ON r.campaign_id=c.id LEFT JOIN whatsapp_core.contacts ct ON ct.id=r.contact_id WHERE c.organization_id=$1 AND c.id=$2 GROUP BY c.id,t.meta_status,p.status`,
        [org, id],
      );
      if (!result) return null;
      const errors: string[] = [];
      if (result.meta_status !== "APPROVED")
        errors.push("Template is not approved");
      if (!["CONNECTED", "VERIFIED", "ACTIVE"].includes(result.sender_status))
        errors.push("Sender is not active");
      if (result.recipients < 1) errors.push("Campaign has no recipients");
      await m.query(
        `UPDATE whatsapp_core.campaign_recipients r SET eligibility=CASE WHEN c.status='SUPPRESSED' OR coalesce((SELECT cc.status FROM whatsapp_core.contact_consents cc WHERE cc.contact_id=c.id AND cc.purpose='MARKETING' ORDER BY cc.created_at DESC LIMIT 1),'OPTED_OUT')<>'OPTED_IN' THEN 'SUPPRESSED' ELSE 'ELIGIBLE' END FROM whatsapp_core.contacts c WHERE r.organization_id=$1 AND r.campaign_id=$2 AND c.id=r.contact_id`,
        [org, id],
      );
      return {
        ...result,
        errors,
        valid: errors.length === 0,
        eligible: result.recipients - result.suppressed,
      };
    });
  }
  recipients(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT r.id,r.eligibility,r.reason,c.id contact_id,c.full_name,c.phone_e164 FROM whatsapp_core.campaign_recipients r JOIN whatsapp_core.contacts c ON c.id=r.contact_id WHERE r.organization_id=$1 AND r.campaign_id=$2 ORDER BY r.id LIMIT 1000`,
        [org, id],
      ),
    );
  }
  metrics(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT count(*)::integer total,count(*) FILTER(WHERE status='QUEUED')::integer queued,
              count(*) FILTER(WHERE status IN('ACCEPTED','SENT','DELIVERED','READ'))::integer accepted,
              count(*) FILTER(WHERE status IN('SENT','DELIVERED','READ'))::integer sent,
              count(*) FILTER(WHERE status IN('DELIVERED','READ'))::integer delivered,count(*) FILTER(WHERE status='READ')::integer read,
              count(*) FILTER(WHERE status='FAILED')::integer failed,count(*) FILTER(WHERE status='CANCELLED')::integer cancelled,
              round(100.0*count(*) FILTER(WHERE status IN('DELIVERED','READ'))/nullif(count(*) FILTER(WHERE status IN('SENT','DELIVERED','READ')),0),2) delivery_rate,
              round(100.0*count(*) FILTER(WHERE status='READ')/nullif(count(*) FILTER(WHERE status IN('DELIVERED','READ')),0),2) read_rate
             FROM whatsapp_core.messages WHERE organization_id=$1 AND campaign_id=$2`,
            [org, id],
          )
        )[0],
    );
  }
}
