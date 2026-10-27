import { OpenAPIObject } from "@nestjs/swagger";
import { normalizeSwaggerResponses } from "./swagger-document.util";

function documentWithResponse(status: string): OpenAPIObject {
  return {
    openapi: "3.0.0",
    info: { title: "Test", version: "1.0" },
    paths: {
      "/products": {
        get: {
          responses: {
            [status]: {
              description: "Product list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ProductListDto" },
                },
              },
            },
          },
        },
      },
    },
  };
}

describe("normalizeSwaggerResponses", () => {
  it("wraps controller payload schemas in the runtime success envelope", () => {
    const document = normalizeSwaggerResponses(documentWithResponse("201"));
    const responses = document.paths["/products"].get?.responses;
    const response = responses?.["200"];

    expect(responses?.["201"]).toBeUndefined();
    expect(response).toMatchObject({
      description: "Product list",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              status: { type: "boolean", example: true },
              code: { type: "integer", example: 200 },
              data: { $ref: "#/components/schemas/ProductListDto" },
            },
          },
        },
      },
    });
  });

  it("creates a documented success envelope when no success response exists", () => {
    const document = documentWithResponse("400");
    normalizeSwaggerResponses(document);

    expect(document.paths["/products"].get?.responses["200"]).toBeDefined();
    expect(document.paths["/products"].get?.responses["400"]).toBeDefined();
  });
});
