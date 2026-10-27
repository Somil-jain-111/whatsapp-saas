export const WORKFLOW_NODE_TYPES = [
  "TRIGGER",
  "CONDITION",
  "SEND_TEMPLATE",
  "SEND_SESSION_MESSAGE",
  "SEND_INTERACTIVE",
  "WAIT",
  "UPDATE_CONTACT",
  "ADD_TAG",
  "REMOVE_TAG",
  "ASSIGN_AGENT",
  "HTTP_REQUEST",
  "WEBHOOK",
  "END",
] as const;
export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number];
export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position?: { x: number; y: number };
  config: Record<string, any>;
}
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  branch?: "true" | "false" | "default";
}
export interface WorkflowGraph {
  triggerConfig: Record<string, any>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}
