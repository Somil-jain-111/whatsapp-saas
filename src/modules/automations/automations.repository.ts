import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { TenantContextService } from "../database/tenant-context.service";
import { EncryptedField } from "../security/encryption/field-encryption.service";
import {
  ChatbotRuleDto,
  ExecutionListDto,
  ListWorkflowDto,
  UpdateWorkflowDto,
} from "./dto/automation.dto";
import { WorkflowGraph } from "./workflow.types";

@Injectable()
export class AutomationsRepository {
  constructor(private readonly tenants: TenantContextService) {}
  create(org: string, user: string, name: string, description?: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.workflows(organization_id,name,description,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,$4,$4) RETURNING *`,
            [org, name.trim(), description?.trim() ?? null, user],
          )
        )[0],
    );
  }
  list(org: string, dto: ListWorkflowDto) {
    const search = dto.search
      ? `%${dto.search.replace(/[\\%_]/g, "\\$&")}%`
      : null;
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT id,name,description,status,revision,published_version,created_at,updated_at,count(*) OVER()::integer total FROM whatsapp_core.workflows WHERE organization_id=$1 AND ($2::varchar IS NULL OR status=$2) AND ($3::varchar IS NULL OR name ILIKE $3 ESCAPE '\\') ORDER BY updated_at DESC,id DESC LIMIT $4 OFFSET $5`,
        [
          org,
          dto.status ?? null,
          search,
          dto.limit,
          (dto.page - 1) * dto.limit,
        ],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
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
            `SELECT * FROM whatsapp_core.workflows WHERE organization_id=$1 AND id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  update(org: string, id: string, user: string, dto: UpdateWorkflowDto) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.workflows SET name=coalesce($5,name),description=CASE WHEN $6 THEN $7 ELSE description END,trigger_config=coalesce($8::jsonb,trigger_config),draft_nodes=coalesce($9::jsonb,draft_nodes),draft_edges=coalesce($10::jsonb,draft_edges),revision=revision+1,updated_by_user_id=$4,updated_at=now(),status=CASE WHEN status='ARCHIVED' THEN status ELSE 'DRAFT' END WHERE organization_id=$1 AND id=$2 AND revision=$3 AND status<>'ARCHIVED' RETURNING *`,
        [
          org,
          id,
          dto.revision,
          user,
          dto.name?.trim() ?? null,
          dto.description !== undefined,
          dto.description?.trim() ?? null,
          dto.triggerConfig ? JSON.stringify(dto.triggerConfig) : null,
          dto.nodes ? JSON.stringify(dto.nodes) : null,
          dto.edges ? JSON.stringify(dto.edges) : null,
        ],
      );
      if (!row)
        throw new ConflictException(
          "Workflow changed or is archived; refresh and retry",
        );
      return row;
    });
  }
  archive(org: string, id: string, user: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.workflows SET status='ARCHIVED',archived_at=now(),updated_by_user_id=$3,updated_at=now(),revision=revision+1 WHERE organization_id=$1 AND id=$2 AND status<>'ACTIVE' RETURNING id,status`,
            [org, id, user],
          )
        )[0] ?? null,
    );
  }
  publish(org: string, id: string, user: string, graph: WorkflowGraph) {
    return this.tenants.run(org, async (m) => {
      const [current] = await m.query(
        `SELECT * FROM whatsapp_core.workflows WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
        [org, id],
      );
      if (!current) throw new NotFoundException("Workflow not found");
      const version = Number(current.published_version ?? 0) + 1;
      const snapshot = JSON.stringify({
        triggerConfig: graph.triggerConfig,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const checksum = createHash("sha256").update(snapshot).digest("hex");
      const [published] = await m.query(
        `INSERT INTO whatsapp_core.workflow_versions(organization_id,workflow_id,version,trigger_config,nodes,edges,checksum,published_by_user_id) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8) RETURNING *`,
        [
          org,
          id,
          version,
          JSON.stringify(graph.triggerConfig),
          JSON.stringify(graph.nodes),
          JSON.stringify(graph.edges),
          checksum,
          user,
        ],
      );
      await m.query(
        `UPDATE whatsapp_core.workflows SET status='PUBLISHED',published_version=$3,revision=revision+1,updated_by_user_id=$4,updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, id, version, user],
      );
      return published;
    });
  }
  setStatus(
    org: string,
    id: string,
    user: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    return this.tenants.run(org, async (m) => {
      const [row] = await m.query(
        `UPDATE whatsapp_core.workflows SET status=$3,revision=revision+1,updated_by_user_id=$4,updated_at=now() WHERE organization_id=$1 AND id=$2 AND published_version IS NOT NULL AND status NOT IN ('ARCHIVED') RETURNING id,status,revision`,
        [org, id, status, user],
      );
      if (!row)
        throw new ConflictException(
          "Publish the workflow before changing its status",
        );
      return row;
    });
  }
  duplicate(org: string, id: string, user: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.workflows(organization_id,name,description,trigger_config,draft_nodes,draft_edges,created_by_user_id,updated_by_user_id) SELECT organization_id,left(name||' copy '||substr(gen_random_uuid()::text,1,6),150),description,trigger_config,draft_nodes,draft_edges,$3,$3 FROM whatsapp_core.workflows WHERE organization_id=$1 AND id=$2 RETURNING *`,
            [org, id, user],
          )
        )[0] ?? null,
    );
  }
  versions(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,version,checksum,published_by_user_id,published_at FROM whatsapp_core.workflow_versions WHERE organization_id=$1 AND workflow_id=$2 ORDER BY version DESC`,
        [org, id],
      ),
    );
  }
  version(org: string, id: string, version: number) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT * FROM whatsapp_core.workflow_versions WHERE organization_id=$1 AND workflow_id=$2 AND version=$3`,
            [org, id, version],
          )
        )[0] ?? null,
    );
  }
  executions(org: string, workflowId: string, dto: ExecutionListDto) {
    return this.tenants.run(org, async (m) => {
      const rows = await m.query(
        `SELECT e.id,e.status,e.step_count,e.failure_code,e.failure_reason,e.started_at,e.updated_at,e.completed_at,v.version,count(*) OVER()::integer total FROM whatsapp_core.workflow_executions e JOIN whatsapp_core.workflow_versions v ON v.id=e.workflow_version_id WHERE e.organization_id=$1 AND e.workflow_id=$2 AND ($3::varchar IS NULL OR e.status=$3) ORDER BY e.updated_at DESC,e.id DESC LIMIT $4 OFFSET $5`,
        [
          org,
          workflowId,
          dto.status ?? null,
          dto.limit,
          (dto.page - 1) * dto.limit,
        ],
      );
      return {
        items: rows.map(({ total: _total, ...row }: any) => row),
        total: rows[0]?.total ?? 0,
        page: dto.page,
        limit: dto.limit,
      };
    });
  }
  execution(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT e.*,w.name workflow_name,w.created_by_user_id,v.version,v.nodes,v.edges,v.trigger_config FROM whatsapp_core.workflow_executions e JOIN whatsapp_core.workflows w ON w.id=e.workflow_id JOIN whatsapp_core.workflow_versions v ON v.id=e.workflow_version_id WHERE e.organization_id=$1 AND e.id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  steps(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,node_id,node_type,attempt_count,status,input,output,error_code,error_message,started_at,completed_at FROM whatsapp_core.workflow_step_executions WHERE organization_id=$1 AND execution_id=$2 ORDER BY started_at,id`,
        [org, id],
      ),
    );
  }
  cancel(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.workflow_executions SET status='CANCELLED',completed_at=now(),lease_until=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status IN ('PENDING','RUNNING','WAITING') RETURNING id,status`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  retry(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.workflow_executions e SET status='PENDING',failure_code=NULL,failure_reason=NULL,lease_until=NULL,completed_at=NULL,updated_at=now() WHERE e.organization_id=$1 AND e.id=$2 AND e.status='FAILED' AND EXISTS(SELECT 1 FROM whatsapp_core.workflow_step_executions s WHERE s.execution_id=e.id AND s.status='FAILED' AND s.attempt_count<3) RETURNING e.id,e.status`,
            [org, id],
          )
        )[0] ?? null,
    );
  }

  async ingestEvent(
    org: string,
    input: {
      externalId: string;
      type: string;
      sourceType?: string;
      sourceId?: string;
      payload: Record<string, any>;
      safePayload: Record<string, any>;
      encrypted: EncryptedField;
      occurredAt: Date;
    },
  ) {
    return this.tenants.run(org, async (m) => {
      const [event] = await m.query(
        `INSERT INTO whatsapp_core.automation_events(organization_id,external_event_id,event_type,source_type,source_id,payload,payload_ciphertext,payload_nonce,payload_auth_tag,payload_key_version,occurred_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) ON CONFLICT(organization_id,external_event_id) DO NOTHING RETURNING *`,
        [
          org,
          input.externalId,
          input.type,
          input.sourceType ?? null,
          input.sourceId ?? null,
          JSON.stringify(input.safePayload),
          input.encrypted.ciphertext,
          input.encrypted.nonce,
          input.encrypted.authTag,
          input.encrypted.keyVersion,
          input.occurredAt,
        ],
      );
      if (!event) return [];
      const active = await m.query(
        `SELECT w.id workflow_id,v.id version_id,v.nodes,v.trigger_config FROM whatsapp_core.workflows w JOIN whatsapp_core.workflow_versions v ON v.workflow_id=w.id AND v.version=w.published_version WHERE w.organization_id=$1 AND w.status='ACTIVE' AND v.trigger_config->>'eventType'=$2 ORDER BY w.id LIMIT 100`,
        [org, input.type],
      );
      const created = [];
      for (const item of active) {
        const keyword = String(item.trigger_config.keyword ?? "")
          .trim()
          .toLowerCase();
        if (
          keyword &&
          this.normalize(String(input.payload.text ?? "")) !==
            this.normalize(keyword)
        )
          continue;
        await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          item.workflow_id,
        ]);
        const [recent] = await m.query(
          `SELECT count(*)::integer value FROM whatsapp_core.workflow_executions WHERE organization_id=$1 AND workflow_id=$2 AND updated_at>now()-interval '1 hour'`,
          [org, item.workflow_id],
        );
        if (Number(recent.value) >= 1000) continue;
        const trigger = (item.nodes as any[]).find(
          (node) => node.type === "TRIGGER",
        );
        const [id] = await m.query(
          `INSERT INTO whatsapp_core.workflow_executions(organization_id,workflow_id,workflow_version_id,trigger_event_id,current_node_id,context) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(organization_id,workflow_id,trigger_event_id) DO NOTHING RETURNING id`,
          [
            org,
            item.workflow_id,
            item.version_id,
            event.id,
            trigger?.id ?? null,
            JSON.stringify({
              event: input.safePayload,
              source: { type: input.sourceType, id: input.sourceId },
            }),
          ],
        );
        if (id) created.push(id.id);
      }
      return created;
    });
  }
  claim(org: string, id: string) {
    return this.tenants.run(org, async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [org]);
      const [limit] = await m.query(
        `SELECT count(*)::integer running FROM whatsapp_core.workflow_executions WHERE organization_id=$1 AND status='RUNNING' AND lease_until>now()`,
        [org],
      );
      if (Number(limit.running) >= 20) return null;
      return (
        (
          await m.query(
            `UPDATE whatsapp_core.workflow_executions SET status='RUNNING',started_at=coalesce(started_at,now()),lease_until=now()+interval '70 seconds',attempt_count=attempt_count+1,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status IN ('PENDING','RUNNING') AND (lease_until IS NULL OR lease_until<now()) AND step_count<250 AND coalesce(started_at,now())>now()-interval '31 days' RETURNING *`,
            [org, id],
          )
        )[0] ?? null
      );
    });
  }
  definition(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT e.*,w.name workflow_name,w.created_by_user_id,v.version,v.nodes,v.edges,v.trigger_config,a.external_event_id,a.payload_ciphertext,a.payload_nonce,a.payload_auth_tag,a.payload_key_version FROM whatsapp_core.workflow_executions e JOIN whatsapp_core.workflows w ON w.id=e.workflow_id JOIN whatsapp_core.workflow_versions v ON v.id=e.workflow_version_id JOIN whatsapp_core.automation_events a ON a.id=e.trigger_event_id WHERE e.organization_id=$1 AND e.id=$2`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  startStep(
    org: string,
    executionId: string,
    node: { id: string; type: string },
    input: Record<string, any>,
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.workflow_step_executions(organization_id,execution_id,node_id,node_type,operation_id,input) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(organization_id,operation_id) DO UPDATE SET attempt_count=workflow_step_executions.attempt_count+1,status='RUNNING',error_code=NULL,error_message=NULL,started_at=now(),completed_at=NULL WHERE workflow_step_executions.status='FAILED' AND workflow_step_executions.attempt_count<3 RETURNING *`,
            [
              org,
              executionId,
              node.id,
              node.type,
              `workflow:${executionId}:${node.id}`,
              JSON.stringify(input),
            ],
          )
        )[0] ?? null,
    );
  }
  advance(
    org: string,
    executionId: string,
    stepId: string,
    next: string | null,
    output: Record<string, any>,
  ) {
    return this.tenants.run(org, async (m) => {
      await m.query(
        `UPDATE whatsapp_core.workflow_step_executions SET status='COMPLETED',output=$4::jsonb,completed_at=now() WHERE organization_id=$1 AND execution_id=$2 AND id=$3`,
        [org, executionId, stepId, JSON.stringify(output)],
      );
      return (
        await m.query(
          `UPDATE whatsapp_core.workflow_executions SET status=CASE WHEN $3::varchar IS NULL THEN 'COMPLETED' ELSE 'PENDING' END,current_node_id=$3,step_count=step_count+1,lease_until=NULL,completed_at=CASE WHEN $3::varchar IS NULL THEN now() END,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [org, executionId, next],
        )
      )[0];
    });
  }
  wait(
    org: string,
    executionId: string,
    stepId: string,
    nodeId: string,
    resumeAt: Date,
    next: string,
  ) {
    return this.tenants.run(org, async (m) => {
      await m.query(
        `UPDATE whatsapp_core.workflow_step_executions SET status='WAITING',completed_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, stepId],
      );
      await m.query(
        `INSERT INTO whatsapp_core.workflow_wait_states(organization_id,execution_id,node_id,resume_at) VALUES($1,$2,$3,$4) ON CONFLICT(execution_id,node_id) DO NOTHING`,
        [org, executionId, nodeId, resumeAt],
      );
      return (
        await m.query(
          `UPDATE whatsapp_core.workflow_executions SET status='WAITING',current_node_id=$3,step_count=step_count+1,lease_until=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
          [org, executionId, next],
        )
      )[0];
    });
  }
  fail(
    org: string,
    executionId: string,
    stepId: string | undefined,
    code: string,
    message: string,
  ) {
    return this.tenants.run(org, async (m) => {
      if (stepId)
        await m.query(
          `UPDATE whatsapp_core.workflow_step_executions SET status='FAILED',error_code=$3,error_message=$4,completed_at=now() WHERE organization_id=$1 AND id=$2`,
          [org, stepId, code, message.slice(0, 500)],
        );
      return m.query(
        `UPDATE whatsapp_core.workflow_executions SET status='FAILED',failure_code=$3,failure_reason=$4,lease_until=NULL,completed_at=now(),updated_at=now() WHERE organization_id=$1 AND id=$2`,
        [org, executionId, code, message.slice(0, 500)],
      );
    });
  }
  dueWaits() {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `WITH due AS(SELECT id FROM whatsapp_core.workflow_wait_states WHERE status='WAITING' AND resume_at<=now() ORDER BY resume_at FOR UPDATE SKIP LOCKED LIMIT 200) UPDATE whatsapp_core.workflow_wait_states w SET status='RESUMED',resumed_at=now() FROM due WHERE w.id=due.id RETURNING w.organization_id,w.execution_id`,
      ),
    );
  }
  resume(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.workflow_executions SET status='PENDING',lease_until=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2 AND status='WAITING'`,
        [org, id],
      ),
    );
  }
  recoverable() {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT organization_id,id FROM whatsapp_core.workflow_executions WHERE status='PENDING' OR (status='RUNNING' AND lease_until<now()) ORDER BY updated_at LIMIT 500`,
      ),
    );
  }
  dueSchedules() {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT w.organization_id,w.id workflow_id,w.trigger_config FROM whatsapp_core.workflows w WHERE w.status='ACTIVE' AND w.trigger_config->>'eventType'='SCHEDULED' AND (w.trigger_config->>'scheduledAt')::timestamptz<=now() ORDER BY (w.trigger_config->>'scheduledAt')::timestamptz LIMIT 200`,
      ),
    );
  }
  actionContext(org: string, contactId?: string, conversationId?: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT ct.id contact_id,ct.phone_e164,ct.custom_attributes,c.id conversation_id,c.sender_id,c.version conversation_version,c.service_window_expires_at FROM whatsapp_core.contacts ct LEFT JOIN whatsapp_core.conversations c ON c.organization_id=ct.organization_id AND c.contact_id=ct.id AND ($3::uuid IS NULL OR c.id=$3) WHERE ct.organization_id=$1 AND ct.id=$2`,
            [org, contactId ?? null, conversationId ?? null],
          )
        )[0] ?? null,
    );
  }
  updateContact(org: string, id: string, attributes: Record<string, any>) {
    return this.tenants.run(org, (m) =>
      m.query(
        `UPDATE whatsapp_core.contacts SET custom_attributes=custom_attributes||$3::jsonb,updated_at=now() WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL`,
        [org, id, JSON.stringify(attributes)],
      ),
    );
  }
  tag(org: string, contactId: string, tagId: string, add: boolean) {
    return this.tenants.run(org, (m) =>
      add
        ? m.query(
            `INSERT INTO whatsapp_core.contact_tag_mappings(organization_id,contact_id,tag_id) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM whatsapp_core.contact_tags WHERE organization_id=$1 AND id=$3) ON CONFLICT DO NOTHING`,
            [org, contactId, tagId],
          )
        : m.query(
            `DELETE FROM whatsapp_core.contact_tag_mappings WHERE organization_id=$1 AND contact_id=$2 AND tag_id=$3`,
            [org, contactId, tagId],
          ),
    );
  }
  createRule(org: string, user: string, dto: ChatbotRuleDto) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.chatbot_rules(organization_id,name,match_type,keywords,response_type,response_config,priority,is_fallback,active,created_by_user_id) VALUES($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8,$9,$10) RETURNING *`,
            [
              org,
              dto.name,
              dto.matchType,
              JSON.stringify(dto.keywords),
              dto.responseType,
              JSON.stringify(dto.responseConfig),
              dto.priority,
              dto.isFallback,
              dto.active,
              user,
            ],
          )
        )[0],
    );
  }
  rules(org: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `SELECT id,name,match_type,keywords,response_type,response_config,priority,is_fallback,active,created_by_user_id,created_at,updated_at FROM whatsapp_core.chatbot_rules WHERE organization_id=$1 ORDER BY priority,id`,
        [org],
      ),
    );
  }
  updateRule(org: string, id: string, dto: ChatbotRuleDto) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.chatbot_rules SET name=$3,match_type=$4,keywords=$5::jsonb,response_type=$6,response_config=$7::jsonb,priority=$8,is_fallback=$9,active=$10,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *`,
            [
              org,
              id,
              dto.name,
              dto.matchType,
              JSON.stringify(dto.keywords),
              dto.responseType,
              JSON.stringify(dto.responseConfig),
              dto.priority,
              dto.isFallback,
              dto.active,
            ],
          )
        )[0] ?? null,
    );
  }
  deleteRule(org: string, id: string) {
    return this.tenants.run(org, (m) =>
      m.query(
        `DELETE FROM whatsapp_core.chatbot_rules WHERE organization_id=$1 AND id=$2`,
        [org, id],
      ),
    );
  }
  createCredential(
    org: string,
    user: string,
    id: string,
    name: string,
    header: string,
    field: EncryptedField,
  ) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `INSERT INTO whatsapp_core.workflow_credentials(id,organization_id,name,header_name,secret_ciphertext,secret_nonce,secret_auth_tag,key_version,created_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,header_name,created_at`,
            [
              id,
              org,
              name,
              header,
              field.ciphertext,
              field.nonce,
              field.authTag,
              field.keyVersion,
              user,
            ],
          )
        )[0],
    );
  }
  credential(org: string, id: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT * FROM whatsapp_core.workflow_credentials WHERE organization_id=$1 AND id=$2 AND revoked_at IS NULL`,
            [org, id],
          )
        )[0] ?? null,
    );
  }
  analytics(org: string, workflowId?: string) {
    return this.tenants.run(
      org,
      async (m) =>
        (
          await m.query(
            `SELECT count(*)::integer executions,count(*) FILTER(WHERE status='COMPLETED')::integer completed,count(*) FILTER(WHERE status='FAILED')::integer failed,count(*) FILTER(WHERE status IN ('PENDING','RUNNING','WAITING'))::integer active,coalesce(round(avg(extract(epoch FROM(completed_at-started_at))) FILTER(WHERE completed_at IS NOT NULL AND started_at IS NOT NULL)),0)::integer avg_duration_seconds FROM whatsapp_core.workflow_executions WHERE organization_id=$1 AND ($2::uuid IS NULL OR workflow_id=$2)`,
            [org, workflowId ?? null],
          )
        )[0],
    );
  }
  adminOverview() {
    return this.tenants.runAsPlatformAdmin(
      async (m) =>
        (
          await m.query(
            `SELECT count(*)::integer workflows,count(*) FILTER(WHERE status='ACTIVE')::integer active_workflows,(SELECT count(*)::integer FROM whatsapp_core.workflow_executions WHERE status='FAILED' AND updated_at>now()-interval '24 hours') recent_failures,(SELECT count(*)::integer FROM(SELECT organization_id FROM whatsapp_core.workflow_executions WHERE updated_at>now()-interval '1 hour' GROUP BY organization_id HAVING count(*)>500) suspicious_tenants) FROM whatsapp_core.workflows`,
          )
        )[0],
    );
  }
  adminExecutions(failed = false) {
    return this.tenants.runAsPlatformAdmin((m) =>
      m.query(
        `SELECT e.id,e.organization_id,w.id workflow_id,w.name workflow_name,e.status,e.step_count,e.failure_code,e.failure_reason,e.started_at,e.updated_at,e.completed_at FROM whatsapp_core.workflow_executions e JOIN whatsapp_core.workflows w ON w.id=e.workflow_id WHERE ($1::boolean=false OR e.status='FAILED') ORDER BY e.updated_at DESC LIMIT 500`,
        [failed],
      ),
    );
  }
  emergencyPause(id: string) {
    return this.tenants.runAsPlatformAdmin(
      async (m) =>
        (
          await m.query(
            `UPDATE whatsapp_core.workflows SET status='PAUSED',revision=revision+1,updated_at=now() WHERE id=$1 AND status='ACTIVE' RETURNING id,organization_id,status`,
            [id],
          )
        )[0] ?? null,
    );
  }
  private normalize(value: string) {
    return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  }
}
