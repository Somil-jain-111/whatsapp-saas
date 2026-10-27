import { Injectable } from "@nestjs/common";
import { TenantContextService } from "../database/tenant-context.service";
import {
  ContactListDto,
  CreateContactDto,
  UpdateContactDto,
} from "./dto/contact.dto";

@Injectable()
export class ContactsRepository {
  constructor(private readonly tenants: TenantContextService) {}

  create(org: string, user: string, dto: CreateContactDto) {
    return this.tenants.run(org, async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        `contacts:${org}`,
      ]);
      const [capacity] = await m.query(
        `SELECT f.quota,(SELECT count(*) FROM whatsapp_core.contacts c WHERE c.organization_id=$1 AND c.deleted_at IS NULL)::bigint used
         FROM whatsapp_core.subscriptions s JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code='contacts' AND f.enabled=true
         WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE') AND s.current_period_end>now()
         ORDER BY s.created_at DESC LIMIT 1`,
        [org],
      );
      if (
        !capacity ||
        (capacity.quota !== null &&
          Number(capacity.used) >= Number(capacity.quota))
      )
        return null;
      return (
        await m.query(
          `INSERT INTO whatsapp_core.contacts(organization_id,full_name,country_code,phone_e164,email,custom_attributes,source,created_by_user_id)
         VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`,
          [
            org,
            dto.fullName.trim(),
            dto.countryCode,
            dto.phoneE164,
            dto.email?.trim().toLowerCase() ?? null,
            JSON.stringify(dto.customAttributes),
            dto.source,
            user,
          ],
        )
      )[0];
    });
  }

  list(org: string, dto: ContactListDto) {
    const pattern = dto.search
      ? `%${dto.search.trim().replace(/[\\%_]/g, "\\$&")}%`
      : null;
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT id,full_name,country_code,phone_e164,email,custom_attributes,source,status,created_at,updated_at,
                count(*) OVER()::integer total
           FROM whatsapp_core.contacts
          WHERE organization_id=$1 AND deleted_at IS NULL AND ($2::varchar IS NULL OR status=$2)
            AND ($3::varchar IS NULL OR full_name ILIKE $3 ESCAPE '\\' OR phone_e164 ILIKE $3 ESCAPE '\\' OR email ILIKE $3 ESCAPE '\\')
          ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`,
        [
          org,
          dto.status ?? null,
          pattern,
          dto.limit,
          (dto.page - 1) * dto.limit,
        ],
      );
      return {
        items: rows.map(
          ({ total: _total, ...row }: Record<string, unknown>) => row,
        ),
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
            `SELECT * FROM whatsapp_core.contacts WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL`,
            [org, id],
          )
        )[0] ?? null,
    );
  }

  update(org: string, id: string, dto: UpdateContactDto) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.contacts SET full_name=coalesce($3,full_name),email=CASE WHEN $4 THEN $5 ELSE email END,
          custom_attributes=coalesce($6::jsonb,custom_attributes),status=coalesce($7,status),updated_at=now()
         WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING *`,
            [
              org,
              id,
              dto.fullName?.trim() ?? null,
              dto.email !== undefined,
              dto.email?.trim().toLowerCase() ?? null,
              dto.customAttributes
                ? JSON.stringify(dto.customAttributes)
                : null,
              dto.status ?? null,
            ],
          )
        )[0] ?? null,
    );
  }

  remove(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.contacts SET status='DELETED',deleted_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL RETURNING id`,
            [org, id],
          )
        ).length === 1,
    );
  }

  consent(
    org: string,
    dto: {
      contactId: string;
      purpose: string;
      status: string;
      source: string;
      policyVersion: string;
      evidenceReference?: string;
    },
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.contact_consents(organization_id,contact_id,purpose,status,source,evidence_reference,policy_version,consented_at,revoked_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='OPTED_IN' THEN now() END,CASE WHEN $4='OPTED_OUT' THEN now() END) RETURNING *`,
            [
              org,
              dto.contactId,
              dto.purpose,
              dto.status,
              dto.source,
              dto.evidenceReference ?? null,
              dto.policyVersion,
            ],
          )
        )[0],
    );
  }

  createTag(org: string, name: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.contact_tags(organization_id,name) VALUES($1,$2) RETURNING *`,
            [org, name.trim()],
          )
        )[0],
    );
  }
  listTags(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT * FROM whatsapp_core.contact_tags WHERE organization_id=$1 ORDER BY name`,
        [org],
      ),
    );
  }
  createSegment(org: string, user: string, name: string, definition: object) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.contact_segments(organization_id,name,definition,created_by_user_id) VALUES($1,$2,$3::jsonb,$4) RETURNING *`,
            [org, name.trim(), JSON.stringify(definition), user],
          )
        )[0],
    );
  }
  listSegments(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT * FROM whatsapp_core.contact_segments WHERE organization_id=$1 ORDER BY created_at DESC`,
        [org],
      ),
    );
  }
  getSegment(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT * FROM whatsapp_core.contact_segments WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }

  createImport(org: string, user: string, objectKey: string, fileType: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.contact_imports(organization_id,object_key,file_type,created_by_user_id)
             VALUES($1,$2,$3,$4) RETURNING id,file_type,status,created_at`,
            [org, objectKey, fileType, user],
          )
        )[0],
    );
  }
  imports(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,file_type,status,total_rows,accepted_rows,rejected_rows,created_at,completed_at,
          (error_object_key IS NOT NULL) has_error_report
         FROM whatsapp_core.contact_imports WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
    );
  }
  import(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT id,file_type,status,total_rows,accepted_rows,rejected_rows,error_object_key,created_at,completed_at,
              coalesce((SELECT jsonb_agg(jsonb_build_object('row',e.row_number,'code',e.code,'message',e.message) ORDER BY e.row_number) FROM (SELECT * FROM whatsapp_core.contact_import_errors WHERE organization_id=$1 AND import_id=$2 ORDER BY row_number LIMIT 100)e),'[]') errors
             FROM whatsapp_core.contact_imports WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  pendingImports() {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT id,organization_id FROM whatsapp_core.contact_imports WHERE status='PENDING' ORDER BY created_at LIMIT 1000`,
      ),
    );
  }
  claimImport(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.contact_imports SET status='PROCESSING'
             WHERE organization_id=$1 AND id=$2 AND status IN ('PENDING','FAILED')
             RETURNING *`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  contactCapacity(org: string): Promise<number | null> {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `SELECT f.quota,(SELECT count(*) FROM whatsapp_core.contacts c WHERE c.organization_id=$1 AND c.deleted_at IS NULL)::bigint used
         FROM whatsapp_core.subscriptions s JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code='contacts'
         WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE') ORDER BY s.created_at DESC LIMIT 1`,
        [org],
      );
      if (!row) return 0;
      if (row.quota === null) return null;
      return Math.max(Number(row.quota) - Number(row.used), 0);
    });
  }
  insertImportedContacts(
    org: string,
    user: string,
    rows: Array<{
      row: number;
      fullName: string;
      countryCode: string;
      phoneE164: string;
      email: string | null;
    }>,
  ) {
    return this.tenants.run(org, async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [
        `contacts:${org}`,
      ]);
      const existing = await m.query(
        `SELECT phone_e164 FROM whatsapp_core.contacts
         WHERE organization_id=$1 AND phone_e164=ANY($2::varchar[])`,
        [org, rows.map((row) => row.phoneE164)],
      );
      const inserted = await m.query(
        `WITH input AS (
           SELECT * FROM jsonb_to_recordset($3::jsonb) AS x(row_number integer,full_name varchar,country_code char(2),phone_e164 varchar,email varchar)
         ), capacity AS (
           SELECT CASE WHEN f.quota IS NULL THEN 2147483647 ELSE greatest(f.quota-(SELECT count(*) FROM whatsapp_core.contacts c WHERE c.organization_id=$1 AND c.deleted_at IS NULL),0) END remaining
           FROM whatsapp_core.subscriptions s JOIN whatsapp_core.plan_features f ON f.plan_id=s.plan_id AND f.code='contacts' AND f.enabled=true
           WHERE s.organization_id=$1 AND s.status IN ('TRIALING','ACTIVE','PAST_DUE') AND s.current_period_end>now()
           ORDER BY s.created_at DESC LIMIT 1
         ), candidates AS (
           SELECT x.* FROM input x WHERE NOT EXISTS(SELECT 1 FROM whatsapp_core.contacts c WHERE c.organization_id=$1 AND c.phone_e164=x.phone_e164)
           ORDER BY x.row_number LIMIT coalesce((SELECT remaining FROM capacity),0)
         )
         INSERT INTO whatsapp_core.contacts(organization_id,full_name,country_code,phone_e164,email,source,created_by_user_id)
         SELECT $1,x.full_name,x.country_code,x.phone_e164,x.email,'IMPORT',$2 FROM candidates x
         ON CONFLICT(organization_id,phone_e164) DO NOTHING RETURNING phone_e164`,
        [
          org,
          user,
          JSON.stringify(
            rows.map((row) => ({
              full_name: row.fullName,
              row_number: row.row,
              country_code: row.countryCode,
              phone_e164: row.phoneE164,
              email: row.email,
            })),
          ),
        ],
      );
      return {
        inserted: new Set<string>(inserted.map((row: any) => row.phone_e164)),
        duplicates: new Set<string>(existing.map((row: any) => row.phone_e164)),
      };
    });
  }
  addImportErrors(
    org: string,
    id: string,
    errors: Array<{
      row: number;
      code: string;
      message: string;
      safe: Record<string, unknown>;
    }>,
  ) {
    if (!errors.length) return Promise.resolve();
    return this.tenants.run(org, async (m) => {
      for (let index = 0; index < errors.length; index += 500)
        await m.query(
          `INSERT INTO whatsapp_core.contact_import_errors(organization_id,import_id,row_number,code,message,safe_row)
           SELECT $1,$2,x.row_number,x.code,x.message,x.safe_row
           FROM jsonb_to_recordset($3::jsonb) AS x(row_number integer,code varchar,message varchar,safe_row jsonb)`,
          [
            org,
            id,
            JSON.stringify(
              errors.slice(index, index + 500).map((error) => ({
                row_number: error.row,
                code: error.code,
                message: error.message.slice(0, 500),
                safe_row: error.safe,
              })),
            ),
          ],
        );
    });
  }
  finishImport(
    org: string,
    id: string,
    result: {
      total: number;
      accepted: number;
      rejected: number;
      errorKey: string | null;
    },
  ) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.contact_imports SET status='COMPLETED',total_rows=$3,accepted_rows=$4,rejected_rows=$5,error_object_key=$6,completed_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [
          org,
          id,
          result.total,
          result.accepted,
          result.rejected,
          result.errorKey,
        ],
      ),
    );
  }
  failImport(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.contact_imports SET status='FAILED' WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }
}
