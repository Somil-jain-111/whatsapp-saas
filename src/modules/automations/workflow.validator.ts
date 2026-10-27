import { BadRequestException, Injectable } from "@nestjs/common";
import {
  WORKFLOW_NODE_TYPES,
  WorkflowEdge,
  WorkflowGraph,
  WorkflowNode,
} from "./workflow.types";
import { validateInteractiveMessage } from "../messaging/interactive-message";

@Injectable()
export class WorkflowValidator {
  validate(graph: WorkflowGraph) {
    const { nodes, edges, triggerConfig } = graph;
    if (
      !triggerConfig ||
      typeof triggerConfig !== "object" ||
      Array.isArray(triggerConfig)
    )
      throw new BadRequestException("Trigger configuration must be an object");
    if (typeof triggerConfig.eventType !== "string")
      throw new BadRequestException("Trigger event type is required");
    if (
      triggerConfig.eventType === "SCHEDULED" &&
      (!triggerConfig.scheduledAt ||
        Number.isNaN(Date.parse(triggerConfig.scheduledAt)) ||
        typeof triggerConfig.timezone !== "string" ||
        !this.isTimezone(triggerConfig.timezone))
    )
      throw new BadRequestException(
        "Scheduled triggers require an ISO timestamp and IANA timezone",
      );
    if (nodes.length < 2 || nodes.length > 100 || edges.length > 200)
      throw new BadRequestException(
        "Workflow must contain 2-100 nodes and no more than 200 edges",
      );
    const ids = new Set<string>();
    for (const node of nodes) {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(node.id) || ids.has(node.id))
        throw new BadRequestException("Node IDs must be unique and URL-safe");
      ids.add(node.id);
      this.validateNode(node);
    }
    const triggers = nodes.filter((node) => node.type === "TRIGGER"),
      ends = nodes.filter((node) => node.type === "END");
    if (triggers.length !== 1 || !ends.length)
      throw new BadRequestException(
        "Workflow requires exactly one trigger and at least one end node",
      );
    const outgoing = new Map<string, WorkflowEdge[]>();
    const incoming = new Map<string, number>();
    for (const edge of edges) {
      if (
        !ids.has(edge.source) ||
        !ids.has(edge.target) ||
        edge.source === edge.target
      )
        throw new BadRequestException("Edge references an invalid node");
      const list = outgoing.get(edge.source) ?? [];
      list.push(edge);
      outgoing.set(edge.source, list);
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    }
    if (incoming.get(triggers[0].id))
      throw new BadRequestException("Trigger cannot have incoming edges");
    for (const end of ends)
      if (outgoing.get(end.id)?.length)
        throw new BadRequestException("End nodes cannot have outgoing edges");
    for (const condition of nodes.filter((node) => node.type === "CONDITION")) {
      const branches = outgoing.get(condition.id) ?? [];
      if (
        branches.length !== 2 ||
        new Set(branches.map((edge) => edge.branch)).size !== 2 ||
        !branches.some((edge) => edge.branch === "true") ||
        !branches.some((edge) => edge.branch === "false")
      )
        throw new BadRequestException(
          "Conditions require true and false branches",
        );
    }
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const walk = (id: string) => {
      if (visiting.has(id))
        throw new BadRequestException("Workflow cycles are not supported");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const edge of outgoing.get(id) ?? []) walk(edge.target);
      visiting.delete(id);
      visited.add(id);
    };
    walk(triggers[0].id);
    if (visited.size !== nodes.length)
      throw new BadRequestException("Workflow contains unreachable nodes");
    for (const node of nodes.filter((item) => item.type !== "END"))
      if (!outgoing.get(node.id)?.length)
        throw new BadRequestException(
          `Node ${node.id} has no termination path`,
        );
    return { valid: true, nodeCount: nodes.length, edgeCount: edges.length };
  }
  private validateNode(node: WorkflowNode) {
    if (!WORKFLOW_NODE_TYPES.includes(node.type))
      throw new BadRequestException(`Unsupported node type ${node.type}`);
    if (
      !node.config ||
      typeof node.config !== "object" ||
      Array.isArray(node.config)
    )
      throw new BadRequestException(`Node ${node.id} configuration is invalid`);
    if (
      node.type === "WAIT" &&
      (Number(node.config.durationSeconds) < 1 ||
        Number(node.config.durationSeconds) > 2592000)
    )
      throw new BadRequestException(
        "Wait must be between 1 second and 30 days",
      );
    if (node.type === "CONDITION") {
      this.validateCondition(node.config, 0);
    }
    if (
      node.type === "SEND_SESSION_MESSAGE" &&
      (typeof node.config.text !== "string" ||
        !node.config.text.trim() ||
        node.config.text.length > 4096)
    )
      throw new BadRequestException("Session message text is invalid");
    if (
      node.type === "SEND_TEMPLATE" &&
      (!this.isUuid(node.config.templateId) ||
        typeof node.config.language !== "string")
    )
      throw new BadRequestException("Template action configuration is invalid");
    if (node.type === "SEND_INTERACTIVE")
      validateInteractiveMessage(node.config.interactive);
    if (
      node.type === "UPDATE_CONTACT" &&
      (!node.config.attributes ||
        typeof node.config.attributes !== "object" ||
        Array.isArray(node.config.attributes) ||
        JSON.stringify(node.config.attributes).length > 16384)
    )
      throw new BadRequestException("Contact update configuration is invalid");
    if (
      ["ADD_TAG", "REMOVE_TAG"].includes(node.type) &&
      !this.isUuid(node.config.tagId)
    )
      throw new BadRequestException("Tag action configuration is invalid");
    if (node.type === "ASSIGN_AGENT" && !this.isUuid(node.config.userId))
      throw new BadRequestException(
        "Agent assignment configuration is invalid",
      );
    if (
      ["HTTP_REQUEST", "WEBHOOK"].includes(node.type) &&
      (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(
        node.config.method ?? "POST",
      ) ||
        typeof node.config.url !== "string")
    )
      throw new BadRequestException("HTTP action configuration is invalid");
  }
  private isUuid(value: unknown) {
    return (
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    );
  }
  private validateCondition(config: Record<string, any>, depth: number) {
    if (depth > 5)
      throw new BadRequestException("Condition nesting is too deep");
    if (["AND", "OR"].includes(config.operator)) {
      if (
        !Array.isArray(config.conditions) ||
        !config.conditions.length ||
        config.conditions.length > 20
      )
        throw new BadRequestException(
          "Condition group must contain 1-20 conditions",
        );
      for (const child of config.conditions)
        this.validateCondition(child, depth + 1);
      return;
    }
    if (
      typeof config.path !== "string" ||
      ![
        "EQUALS",
        "NOT_EQUALS",
        "CONTAINS",
        "GREATER_THAN",
        "LESS_THAN",
        "EXISTS",
        "NOT_EXISTS",
      ].includes(config.operator)
    )
      throw new BadRequestException("Condition configuration is invalid");
  }
  private isTimezone(value: string) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }
}

@Injectable()
export class ConditionEvaluator {
  evaluate(config: Record<string, any>, context: Record<string, any>) {
    return this.evaluateAt(config, context, 0);
  }
  private evaluateAt(
    config: Record<string, any>,
    context: Record<string, any>,
    depth: number,
  ): boolean {
    if (depth > 5)
      throw new BadRequestException("Condition nesting is too deep");
    if (["AND", "OR"].includes(config.operator)) {
      if (
        !Array.isArray(config.conditions) ||
        !config.conditions.length ||
        config.conditions.length > 20
      )
        throw new BadRequestException("Condition group is invalid");
      return config.operator === "AND"
        ? config.conditions.every((child: Record<string, any>) =>
            this.evaluateAt(child, context, depth + 1),
          )
        : config.conditions.some((child: Record<string, any>) =>
            this.evaluateAt(child, context, depth + 1),
          );
    }
    const path = String(config.path ?? "");
    const parts = path.split(".");
    if (
      !/^[A-Za-z0-9_.]{1,200}$/.test(path) ||
      parts.length > 10 ||
      parts.some((part) =>
        ["__proto__", "prototype", "constructor"].includes(part),
      )
    )
      throw new BadRequestException("Condition path is invalid");
    let actual: any = context;
    for (const part of parts) actual = actual?.[part];
    const expected = config.value;
    switch (config.operator) {
      case "EQUALS":
        return actual === expected;
      case "NOT_EQUALS":
        return actual !== expected;
      case "CONTAINS":
        return typeof actual === "string"
          ? actual.includes(String(expected))
          : Array.isArray(actual) && actual.includes(expected);
      case "GREATER_THAN":
        return typeof actual === "number" && actual > Number(expected);
      case "LESS_THAN":
        return typeof actual === "number" && actual < Number(expected);
      case "EXISTS":
        return actual !== undefined && actual !== null;
      case "NOT_EXISTS":
        return actual === undefined || actual === null;
      default:
        throw new BadRequestException("Condition operator is invalid");
    }
  }
}
