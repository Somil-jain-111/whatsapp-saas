import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Queue } from "bullmq";
import { randomUUID } from "crypto";
import { AuditRepository } from "../audit/audit.repository";
import { ConversationsService } from "../conversations/conversations.service";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { validateInteractiveMessage } from "../messaging/interactive-message";
import { AutomationsRepository } from "./automations.repository";
import { matchesChatbotRule } from "./chatbot.matcher";
import {
  ChatbotRuleDto,
  CreateWorkflowDto,
  CredentialDto,
  ExecutionListDto,
  ListWorkflowDto,
  SandboxDto,
  UpdateWorkflowDto,
} from "./dto/automation.dto";
import { ConditionEvaluator, WorkflowValidator } from "./workflow.validator";
import { WorkflowGraph, WorkflowNode } from "./workflow.types";

export const WORKFLOW_QUEUE = "workflow-execution";

@Injectable()
export class AutomationsService implements OnModuleInit {
  constructor(
    private readonly repo: AutomationsRepository,
    private readonly validator: WorkflowValidator,
    private readonly conditions: ConditionEvaluator,
    private readonly conversations: ConversationsService,
    private readonly encryption: FieldEncryptionService,
    private readonly audit: AuditRepository,
    @InjectQueue(WORKFLOW_QUEUE) private readonly queue: Queue,
  ) {}
  async onModuleInit() {
    await this.queue.add(
      "recovery",
      {},
      {
        jobId: "workflow-recovery",
        repeat: { every: 30000 },
        removeOnComplete: 5,
      },
    );
  }
  async create(org: string, user: string, dto: CreateWorkflowDto) {
    const result = await this.repo.create(org, user, dto.name, dto.description);
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.created",
      resourceType: "workflow",
      resourceId: result.id,
    });
    return result;
  }
  list(org: string, dto: ListWorkflowDto) {
    return this.repo.list(org, dto);
  }
  async get(org: string, id: string) {
    const row = await this.repo.get(org, id);
    if (!row) throw new NotFoundException("Workflow not found");
    return row;
  }
  update(org: string, id: string, user: string, dto: UpdateWorkflowDto) {
    return this.repo.update(org, id, user, dto);
  }
  async archive(org: string, id: string, user: string) {
    const result = await this.repo.archive(org, id, user);
    if (!result)
      throw new ConflictException(
        "Active workflows must be paused before archiving",
      );
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.archived",
      resourceType: "workflow",
      resourceId: id,
    });
    return result;
  }
  async validate(org: string, id: string) {
    const value = await this.get(org, id);
    return this.validator.validate(this.graph(value));
  }
  async publish(org: string, id: string, user: string) {
    const value = await this.get(org, id),
      graph = this.graph(value);
    this.validator.validate(graph);
    const result = await this.repo.publish(org, id, user, graph);
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.published",
      resourceType: "workflow",
      resourceId: id,
      metadata: { version: result.version },
    });
    return result;
  }
  async setStatus(
    org: string,
    id: string,
    user: string,
    status: "ACTIVE" | "PAUSED",
  ) {
    const result = await this.repo.setStatus(org, id, user, status);
    await this.audit.append(org, {
      actorUserId: user,
      action: `workflow.${status.toLowerCase()}`,
      resourceType: "workflow",
      resourceId: id,
    });
    return result;
  }
  duplicate(org: string, id: string, user: string) {
    return this.repo.duplicate(org, id, user);
  }
  versions(org: string, id: string) {
    return this.repo.versions(org, id);
  }
  async version(org: string, id: string, version: number) {
    const value = await this.repo.version(org, id, version);
    if (!value) throw new NotFoundException("Workflow version not found");
    return value;
  }
  executions(org: string, id: string, dto: ExecutionListDto) {
    return this.repo.executions(org, id, dto);
  }
  async execution(org: string, id: string) {
    const value = await this.repo.execution(org, id);
    if (!value) throw new NotFoundException("Execution not found");
    return value;
  }
  steps(org: string, id: string) {
    return this.repo.steps(org, id);
  }
  async cancel(org: string, id: string, user: string) {
    const result = await this.repo.cancel(org, id);
    if (!result) throw new ConflictException("Execution cannot be cancelled");
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.execution.cancelled",
      resourceType: "workflow_execution",
      resourceId: id,
    });
    return result;
  }
  async retry(org: string, id: string, user: string) {
    const result = await this.repo.retry(org, id);
    if (!result)
      throw new ConflictException("Execution is not eligible for retry");
    await this.enqueueExecution(org, id);
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.execution.retried",
      resourceType: "workflow_execution",
      resourceId: id,
    });
    return result;
  }
  createRule(org: string, user: string, dto: ChatbotRuleDto) {
    this.validateRule(dto);
    return this.repo.createRule(org, user, dto);
  }
  rules(org: string) {
    return this.repo.rules(org);
  }
  updateRule(org: string, id: string, dto: ChatbotRuleDto) {
    this.validateRule(dto);
    return this.repo.updateRule(org, id, dto);
  }
  deleteRule(org: string, id: string) {
    return this.repo.deleteRule(org, id);
  }
  async createCredential(org: string, user: string, dto: CredentialDto) {
    const id = randomUUID(),
      field = await this.encryption.encrypt(
        Buffer.from(dto.secret),
        `workflow-credential:${org}:${id}`,
      );
    const result = await this.repo.createCredential(
      org,
      user,
      id,
      dto.name,
      dto.headerName,
      field,
    );
    await this.audit.append(org, {
      actorUserId: user,
      action: "workflow.credential.created",
      resourceType: "workflow_credential",
      resourceId: result.id,
    });
    return result;
  }
  analytics(org: string, id?: string) {
    return this.repo.analytics(org, id);
  }
  async adminOverview() {
    const [overview, queue] = await Promise.all([
      this.repo.adminOverview(),
      this.queue.getJobCounts("waiting", "active", "delayed", "failed"),
    ]);
    return { ...overview, queue };
  }
  adminExecutions(failed = false) {
    return this.repo.adminExecutions(failed);
  }
  async emergencyPause(id: string, user: string) {
    const result = await this.repo.emergencyPause(id);
    if (!result) throw new ConflictException("Workflow is not active");
    await this.audit.append(result.organization_id, {
      actorUserId: user,
      action: "workflow.emergency_paused",
      resourceType: "workflow",
      resourceId: id,
    });
    return result;
  }
  async sandbox(org: string, id: string, dto: SandboxDto) {
    const workflow = await this.get(org, id),
      graph = this.graph(workflow);
    this.validator.validate(graph);
    const trace: any[] = [];
    let current = graph.nodes.find((node) => node.type === "TRIGGER")!,
      steps = 0;
    while (current && steps++ < 100) {
      if (current.type === "CONDITION") {
        const result = this.conditions.evaluate(current.config, {
          event: dto.payload,
          variables: dto.variables,
        });
        trace.push({ nodeId: current.id, type: current.type, result });
        current = this.next(graph, current, result ? "true" : "false");
        continue;
      }
      trace.push({
        nodeId: current.id,
        type: current.type,
        effect: [
          "SEND_TEMPLATE",
          "SEND_SESSION_MESSAGE",
          "SEND_INTERACTIVE",
          "HTTP_REQUEST",
          "WEBHOOK",
        ].includes(current.type)
          ? "PREVIEW_ONLY"
          : "NONE",
        config: current.config,
      });
      if (current.type === "END") break;
      current = this.next(graph, current, "default");
    }
    return { sandbox: true, valid: true, trace };
  }
  async trigger(
    org: string,
    event: {
      externalId: string;
      type: string;
      sourceType?: string;
      sourceId?: string;
      payload: Record<string, any>;
      occurredAt?: Date;
    },
  ) {
    const encrypted = await this.encryption.encrypt(
      Buffer.from(JSON.stringify(event.payload)),
      `automation-event:${org}:${event.externalId}`,
    );
    const safePayload = Object.fromEntries(
      Object.entries(event.payload).filter(
        ([key]) => !["text", "body", "parameters", "content"].includes(key),
      ),
    );
    const ids = await this.repo.ingestEvent(org, {
      ...event,
      safePayload,
      encrypted,
      occurredAt: event.occurredAt ?? new Date(),
    });
    for (const id of ids) await this.enqueueExecution(org, id);
    return { created: ids.length };
  }
  @OnEvent("automation.trigger", { async: true }) async onTrigger(event: any) {
    const result = await this.trigger(event.organizationId, event);
    if (event.type === "INCOMING_MESSAGE")
      await this.runChatbot(event.organizationId, event.payload);
    return result;
  }
  @OnEvent("developer.webhook", { async: true })
  async onPlatformEvent(event: any) {
    const type = String(event.eventType ?? "")
      .toUpperCase()
      .replaceAll(".", "_");
    if (
      ![
        "CAMPAIGN_STARTED",
        "CAMPAIGN_COMPLETED",
        "CAMPAIGN_FAILED",
        "MESSAGE_DELIVERED",
        "MESSAGE_FAILED",
      ].includes(type)
    )
      return;
    const resourceId = String(
      event.payload?.campaign_id ?? event.payload?.message_id ?? "",
    );
    if (!event.organizationId || !resourceId) return;
    await this.trigger(event.organizationId, {
      externalId: `${event.eventType}:${resourceId}:${event.payload?.status ?? "event"}`,
      type,
      sourceType: type.startsWith("CAMPAIGN_") ? "CAMPAIGN" : "MESSAGE",
      sourceId: resourceId,
      payload: event.payload,
    });
  }
  async recovery() {
    const waits = await this.repo.dueWaits();
    for (const item of waits) {
      await this.repo.resume(item.organization_id, item.execution_id);
      await this.enqueueExecution(item.organization_id, item.execution_id);
    }
    const executions = await this.repo.recoverable();
    for (const item of executions)
      await this.enqueueExecution(item.organization_id, item.id);
    const schedules = await this.repo.dueSchedules();
    for (const item of schedules)
      await this.trigger(item.organization_id, {
        externalId: `scheduled:${item.workflow_id}:${item.trigger_config.scheduledAt}`,
        type: "SCHEDULED",
        sourceType: "WORKFLOW",
        sourceId: item.workflow_id,
        payload: {
          workflowId: item.workflow_id,
          scheduledAt: item.trigger_config.scheduledAt,
        },
      });
    return waits.length + executions.length + schedules.length;
  }
  enqueueExecution(org: string, id: string, delay = 0) {
    return this.queue.add(
      "execute",
      { organizationId: org, executionId: id },
      {
        jobId: `workflow-${id}-${Date.now() + delay}`,
        delay,
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }
  private graph(row: any): WorkflowGraph {
    return {
      triggerConfig: row.trigger_config ?? {},
      nodes: row.draft_nodes ?? [],
      edges: row.draft_edges ?? [],
    };
  }
  private next(
    graph: WorkflowGraph,
    node: WorkflowNode,
    branch: "true" | "false" | "default",
  ) {
    const edge =
      graph.edges.find(
        (item) =>
          item.source === node.id &&
          (node.type !== "CONDITION" || (item.branch ?? "default") === branch),
      ) ?? graph.edges.find((item) => item.source === node.id);
    return edge
      ? graph.nodes.find((item) => item.id === edge.target)!
      : (null as any);
  }
  private validateRule(dto: ChatbotRuleDto) {
    if (
      dto.keywords.length > 50 ||
      dto.keywords.some(
        (word) => typeof word !== "string" || !word.trim() || word.length > 100,
      )
    )
      throw new BadRequestException("Chatbot keywords are invalid");
    if (!dto.isFallback && !dto.keywords.length)
      throw new BadRequestException("A non-fallback rule requires a keyword");
    if (
      dto.responseType === "SESSION_MESSAGE" &&
      !String(dto.responseConfig.text ?? "").trim()
    )
      throw new BadRequestException("A session message response requires text");
    if (
      dto.responseType === "TEMPLATE" &&
      !String(dto.responseConfig.templateId ?? "").trim()
    )
      throw new BadRequestException(
        "A template response requires a templateId",
      );
    if (dto.responseType === "INTERACTIVE")
      validateInteractiveMessage(dto.responseConfig.interactive);
    if (
      dto.responseType === "AGENT_HANDOFF" &&
      !String(dto.responseConfig.agentId ?? "").trim()
    )
      throw new BadRequestException("Agent handoff requires an agentId");
  }
  private async runChatbot(org: string, payload: Record<string, any>) {
    const rules = await this.repo.rules(org),
      input = String(payload.text ?? "");
    const rule =
      rules.find(
        (item: any) =>
          item.active &&
          !item.is_fallback &&
          (item.keywords as string[]).some((keyword) =>
            matchesChatbotRule(input, item.match_type, keyword),
          ),
      ) ?? rules.find((item: any) => item.active && item.is_fallback);
    if (!rule) return;
    const conversation = await this.conversations.get(
      org,
      String(payload.conversationId),
    );
    const actor = String(
      rule.created_by_user_id ?? conversation.assigned_user_id ?? "",
    );
    if (!actor) return;
    if (rule.response_type === "AGENT_HANDOFF") {
      if (rule.response_config.agentId)
        await this.conversations.assign(
          org,
          conversation.id,
          actor,
          rule.response_config.agentId,
          conversation.version,
          "Chatbot handoff",
        );
      return;
    }
    await this.conversations.automationReply(
      org,
      conversation.id,
      actor,
      rule.response_type === "TEMPLATE"
        ? {
            type: "TEMPLATE",
            templateId: rule.response_config.templateId,
            language: rule.response_config.language ?? "en",
            parameters: rule.response_config.parameters ?? {},
            idempotencyKey: `chatbot:${payload.messageId}:${rule.id}`,
          }
        : rule.response_type === "INTERACTIVE"
          ? {
              type: "INTERACTIVE",
              interactive: rule.response_config.interactive,
              parameters: {},
              idempotencyKey: `chatbot:${payload.messageId}:${rule.id}`,
            }
          : {
              type: "TEXT",
              text: String(rule.response_config.text ?? ""),
              parameters: {},
              idempotencyKey: `chatbot:${payload.messageId}:${rule.id}`,
            },
    );
  }
}
