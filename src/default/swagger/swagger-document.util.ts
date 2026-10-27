import { OpenAPIObject } from "@nestjs/swagger";
import {
  OperationObject,
  ResponseObject,
  SchemaObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

const SUCCESS_ENVELOPE_FIELDS: Record<string, SchemaObject> = {
  status: { type: "boolean", example: true },
  code: { type: "integer", example: 200 },
  message: { type: "string", example: "Request successful" },
  timestamp: { type: "string", format: "date-time" },
  path: { type: "string", example: "/api/v1/products" },
  sub: { type: "string", nullable: true },
  journeyId: { type: "string", nullable: true },
};

/**
 * Aligns generated OpenAPI success schemas with UnifiedResponseInterceptor.
 * Controllers describe their data payload; this function documents the actual wire envelope.
 */
export function normalizeSwaggerResponses(
  document: OpenAPIObject,
): OpenAPIObject {
  for (const pathItem of Object.values(document.paths)) {
    if (!pathItem) continue;

    for (const method of [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
    ] as const) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;
      wrapSuccessResponse(operation);
    }
  }

  return document;
}

function wrapSuccessResponse(operation: OperationObject): void {
  const successfulStatus = Object.keys(operation.responses).find((status) =>
    /^2\d\d$/.test(status),
  );
  const original = successfulStatus
    ? (operation.responses[successfulStatus] as ResponseObject)
    : undefined;
  const dataSchema = original?.content?.["application/json"]?.schema as
    SchemaObject | undefined;

  for (const status of Object.keys(operation.responses)) {
    if (/^2\d\d$/.test(status)) delete operation.responses[status];
  }

  operation.responses["200"] = {
    description: original?.description || "Request completed successfully",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["status", "code", "message", "data", "timestamp", "path"],
          properties: {
            ...SUCCESS_ENVELOPE_FIELDS,
            data: dataSchema ?? { nullable: true },
          },
        },
      },
    },
  };
}
