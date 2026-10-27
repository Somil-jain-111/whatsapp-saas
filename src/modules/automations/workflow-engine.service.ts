import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AuditRepository } from "../audit/audit.repository";
import { ConversationsService } from "../conversations/conversations.service";
import { WebhookDestinationPolicy } from "../developer-portal/webhook-destination.policy";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { AutomationsRepository } from "./automations.repository";
import { AutomationsService } from "./automations.service";
import { ConditionEvaluator } from "./workflow.validator";
import { WorkflowEdge, WorkflowNode } from "./workflow.types";

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly repo: AutomationsRepository,
    private readonly automations: AutomationsService,
    private readonly conditions: ConditionEvaluator,
    private readonly conversations: ConversationsService,
    private readonly destinations: WebhookDestinationPolicy,
    private readonly http: HttpService,
    private readonly encryption: FieldEncryptionService,
    private readonly audit: AuditRepository,
  ) {}
  async execute(org: string, id: string) {
    const claimed = await this.repo.claim(org, id);
    if (!claimed) return;
    let stepId: string | undefined;
    try {
      const execution = await this.repo.definition(org, id);
      const event = JSON.parse(
        (
          await this.encryption.decrypt(
            {
              ciphertext: execution.payload_ciphertext,
              nonce: execution.payload_nonce,
              authTag: execution.payload_auth_tag,
              keyVersion: execution.payload_key_version,
            },
            `automation-event:${org}:${execution.external_event_id}`,
          )
        ).toString("utf8"),
      );
      execution.context = { ...execution.context, event };
      const nodes = execution.nodes as WorkflowNode[],
        edges = execution.edges as WorkflowEdge[],
        node = nodes.find((item) => item.id === execution.current_node_id);
      if (!node)
        throw this.error(
          "NODE_NOT_FOUND",
          "Current workflow node does not exist",
        );
      const step = await this.repo.startStep(org, id, node, {
        eventId: execution.trigger_event_id,
      });
      if (!step)
        throw this.error(
          "STEP_RETRY_EXHAUSTED",
          "Workflow step retry limit reached",
        );
      stepId = step.id;
      if (step.status === "COMPLETED") return;
      let output: Record<string, any> = {},
        branch: "true" | "false" | "default" = "default";
      const contactId = event.contactId,
        conversationId = event.conversationId;
      switch (node.type) {
        case "TRIGGER":
          break;
        case "CONDITION": {
          const result = this.conditions.evaluate(node.config, {
            event,
            variables: execution.variables,
            source: execution.context.source,
          });
          output = { result };
          branch = result ? "true" : "false";
          break;
        }
        case "SEND_SESSION_MESSAGE":
          await this.requireConversation(
            org,
            conversationId,
            execution.created_by_user_id,
            {
              type: "TEXT",
              text: this.interpolate(
                String(node.config.text ?? ""),
                execution.context,
              ),
              parameters: {},
              idempotencyKey: step.operation_id,
            },
          );
          output = { queued: true };
          break;
        case "SEND_TEMPLATE":
          await this.requireConversation(
            org,
            conversationId,
            execution.created_by_user_id,
            {
              type: "TEMPLATE",
              templateId: node.config.templateId,
              language: node.config.language ?? "en",
              parameters: node.config.parameters ?? {},
              idempotencyKey: step.operation_id,
            },
          );
          output = { queued: true };
          break;
        case "SEND_INTERACTIVE":
          await this.requireConversation(
            org,
            conversationId,
            execution.created_by_user_id,
            {
              type: "INTERACTIVE",
              interactive: node.config.interactive,
              parameters: {},
              idempotencyKey: step.operation_id,
            },
          );
          output = { queued: true };
          break;
        case "WAIT": {
          const seconds = Number(node.config.durationSeconds),
            next = this.next(edges, node.id, "default");
          if (!next)
            throw this.error("NO_NEXT_NODE", "Wait node has no next node");
          const resumeAt = new Date(Date.now() + seconds * 1000);
          await this.repo.wait(org, id, step.id, node.id, resumeAt, next);
          return;
        }
        case "UPDATE_CONTACT":
          if (!contactId)
            throw this.error(
              "CONTACT_REQUIRED",
              "Trigger did not provide a contact",
            );
          await this.repo.updateContact(
            org,
            contactId,
            node.config.attributes ?? {},
          );
          output = { updated: true };
          break;
        case "ADD_TAG":
        case "REMOVE_TAG":
          if (!contactId)
            throw this.error(
              "CONTACT_REQUIRED",
              "Trigger did not provide a contact",
            );
          await this.repo.tag(
            org,
            contactId,
            node.config.tagId,
            node.type === "ADD_TAG",
          );
          if (node.type === "ADD_TAG")
            await this.automations.trigger(org, {
              externalId: `${step.operation_id}:tag`,
              type: "CONTACT_TAG_ADDED",
              sourceType: "CONTACT",
              sourceId: contactId,
              payload: { contactId, tagId: node.config.tagId },
            });
          output = { updated: true };
          break;
        case "ASSIGN_AGENT": {
          if (!conversationId)
            throw this.error(
              "CONVERSATION_REQUIRED",
              "Trigger did not provide a conversation",
            );
          const conversation = await this.conversations.get(
            org,
            conversationId,
          );
          await this.conversations.assign(
            org,
            conversationId,
            execution.created_by_user_id,
            node.config.userId,
            conversation.version,
            "Workflow assignment",
          );
          output = { assigned: true };
          break;
        }
        case "HTTP_REQUEST":
        case "WEBHOOK":
          output = await this.request(
            org,
            node,
            execution.context,
            step.operation_id,
          );
          break;
        case "END":
          break;
      }
      const next =
        node.type === "END" ? null : this.next(edges, node.id, branch);
      await this.repo.advance(org, id, step.id, next, output);
      if (next) await this.automations.enqueueExecution(org, id);
      else
        await this.audit.append(org, {
          action: "workflow.execution.completed",
          resourceType: "workflow_execution",
          resourceId: id,
          metadata: { workflowId: execution.workflow_id },
        });
    } catch (error: any) {
      await this.repo.fail(
        org,
        id,
        stepId,
        error.code ?? "STEP_FAILED",
        error instanceof Error ? error.message : "Workflow step failed",
      );
      throw error;
    }
  }
  private async requireConversation(
    org: string,
    id: string | undefined,
    user: string,
    dto: any,
  ) {
    if (!id)
      throw this.error(
        "CONVERSATION_REQUIRED",
        "Trigger did not provide a conversation",
      );
    return this.conversations.automationReply(org, id, user, dto);
  }
  private next(edges: WorkflowEdge[], source: string, branch: string) {
    return (
      edges.find(
        (edge) =>
          edge.source === source && (edge.branch ?? "default") === branch,
      )?.target ??
      edges.find((edge) => edge.source === source)?.target ??
      null
    );
  }
  private interpolate(value: string, context: Record<string, any>) {
    return value
      .replace(/\{\{([A-Za-z0-9_.]{1,100})\}\}/g, (_match, path) => {
        let current: any = context;
        for (const part of String(path).split(".")) current = current?.[part];
        return current === undefined || current === null
          ? ""
          : String(current).slice(0, 1000);
      })
      .slice(0, 4096);
  }
  private async request(
    org: string,
    node: WorkflowNode,
    context: Record<string, any>,
    operationId: string,
  ) {
    await this.destinations.assertPublicHttps(node.config.url);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": operationId,
    };
    if (node.config.credentialId) {
      const credential = await this.repo.credential(
        org,
        node.config.credentialId,
      );
      if (!credential)
        throw this.error(
          "CREDENTIAL_NOT_FOUND",
          "Workflow credential is unavailable",
        );
      headers[credential.header_name] = (
        await this.encryption.decrypt(
          {
            ciphertext: credential.secret_ciphertext,
            nonce: credential.secret_nonce,
            authTag: credential.secret_auth_tag,
            keyVersion: credential.key_version,
          },
          `workflow-credential:${org}:${credential.id}`,
        )
      ).toString("utf8");
    }
    const response = await firstValueFrom(
      this.http.request({
        url: node.config.url,
        method: node.config.method ?? "POST",
        headers,
        data: node.config.body ?? context.event,
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 65536,
        maxBodyLength: 65536,
        validateStatus: (status) => status >= 200 && status < 300,
      }),
    );
    return {
      status: response.status,
      data:
        typeof response.data === "object"
          ? response.data
          : { value: String(response.data).slice(0, 1000) },
    };
  }
  private error(code: string, message: string) {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
  }
}
