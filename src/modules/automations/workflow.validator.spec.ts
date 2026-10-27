import { BadRequestException } from "@nestjs/common";
import { ConditionEvaluator, WorkflowValidator } from "./workflow.validator";

const valid = {
  triggerConfig: { eventType: "INCOMING_MESSAGE" },
  nodes: [
    { id: "start", type: "TRIGGER" as const, config: {} },
    {
      id: "condition",
      type: "CONDITION" as const,
      config: { path: "event.total", operator: "GREATER_THAN", value: 10 },
    },
    { id: "yes", type: "END" as const, config: {} },
    { id: "no", type: "END" as const, config: {} },
  ],
  edges: [
    { id: "a", source: "start", target: "condition" },
    { id: "b", source: "condition", target: "yes", branch: "true" as const },
    { id: "c", source: "condition", target: "no", branch: "false" as const },
  ],
};
describe("WorkflowValidator", () => {
  const validator = new WorkflowValidator();
  it("accepts a bounded terminating DAG", () =>
    expect(validator.validate(valid)).toEqual({
      valid: true,
      nodeCount: 4,
      edgeCount: 3,
    }));
  it("rejects cycles", () =>
    expect(() =>
      validator.validate({
        ...valid,
        nodes: [
          { id: "start", type: "TRIGGER", config: {} },
          { id: "loop", type: "SEND_SESSION_MESSAGE", config: {} },
          { id: "end", type: "END", config: {} },
        ] as any,
        edges: [
          { id: "a", source: "start", target: "loop" },
          { id: "b", source: "loop", target: "start" },
          { id: "c", source: "loop", target: "end" },
        ],
      }),
    ).toThrow(BadRequestException));
  it("rejects unreachable nodes", () =>
    expect(() =>
      validator.validate({
        ...valid,
        nodes: [...valid.nodes, { id: "orphan", type: "END", config: {} }],
      }),
    ).toThrow("unreachable"));
});
describe("ConditionEvaluator", () => {
  const evaluator = new ConditionEvaluator();
  it("evaluates allowlisted nested paths", () =>
    expect(
      evaluator.evaluate(
        { path: "event.total", operator: "GREATER_THAN", value: 5 },
        { event: { total: 8 } },
      ),
    ).toBe(true));
  it("evaluates bounded AND and OR groups", () =>
    expect(
      evaluator.evaluate(
        {
          operator: "AND",
          conditions: [
            { path: "event.total", operator: "GREATER_THAN", value: 5 },
            {
              operator: "OR",
              conditions: [
                { path: "event.status", operator: "EQUALS", value: "OPEN" },
                { path: "event.status", operator: "EQUALS", value: "NEW" },
              ],
            },
          ],
        },
        { event: { total: 8, status: "OPEN" } },
      ),
    ).toBe(true));
  it("rejects prototype and bracket paths", () =>
    expect(() =>
      evaluator.evaluate(
        { path: "event[constructor]", operator: "EXISTS" },
        { event: {} },
      ),
    ).toThrow(BadRequestException));
  it("rejects prototype property traversal", () =>
    expect(() =>
      evaluator.evaluate(
        { path: "event.__proto__.secret", operator: "EXISTS" },
        { event: {} },
      ),
    ).toThrow(BadRequestException));
});
