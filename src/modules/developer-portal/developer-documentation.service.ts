import { Injectable } from "@nestjs/common";
import { API_SCOPES } from "./dto/developer-portal.dto";

@Injectable()
export class DeveloperDocumentationService {
  openApi(baseUrl: string) {
    const bearer = [
      { apiKey: [] },
      { oauth2: [] },
      { hmacKeyId: [], hmacTimestamp: [], hmacSignature: [] },
    ];
    const error = {
      type: "object",
      required: ["success", "error", "request_id"],
      properties: {
        success: { type: "boolean", const: false },
        error: {
          type: "object",
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
        },
        request_id: { type: "string", format: "uuid" },
      },
    };
    return {
      openapi: "3.1.0",
      info: {
        title: "Relay WhatsApp Public API",
        version: "1.0.0",
        description:
          "Server-to-server WhatsApp API. Authenticate with an API key, a short-lived OAuth client-credentials token, or an HMAC-signed request. Message creation requires Idempotency-Key and returns 202 until Meta confirms delivery.",
      },
      servers: [{ url: `${baseUrl}/public/v1` }],
      components: {
        securitySchemes: {
          apiKey: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "wsa_live_…",
          },
          oauth2: {
            type: "oauth2",
            flows: {
              clientCredentials: {
                tokenUrl: `${baseUrl}/public/oauth/token`,
                scopes: Object.fromEntries(
                  API_SCOPES.map((scope) => [scope, scope]),
                ),
              },
            },
          },
          hmacKeyId: { type: "apiKey", in: "header", name: "X-Relay-Key-Id" },
          hmacTimestamp: {
            type: "apiKey",
            in: "header",
            name: "X-Relay-Timestamp",
          },
          hmacSignature: {
            type: "apiKey",
            in: "header",
            name: "X-Relay-Signature",
          },
          mutualTls: { type: "mutualTLS" },
        },
        schemas: {
          Error: error,
          TemplateMessage: {
            type: "object",
            additionalProperties: false,
            required: [
              "to",
              "sender_id",
              "template_id",
              "language",
              "parameters",
            ],
            properties: {
              to: { type: "string", pattern: "^\\+[1-9][0-9]{1,14}$" },
              sender_id: { type: "string", format: "uuid" },
              template_id: { type: "string", format: "uuid" },
              language: { type: "string", maxLength: 20 },
              parameters: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
      security: bearer,
      paths: {
        "/messages/template": this.postMessage(),
        "/messages/{id}": this.getById("messages:read", "Message"),
        "/templates": this.list("templates:read", "Templates"),
        "/templates/{id}": this.getById("templates:read", "Template"),
        "/campaigns": this.list("campaigns:read", "Campaigns"),
        "/campaigns/{id}": this.getById("campaigns:read", "Campaign"),
        "/reports/messages": this.list("reports:read", "Message report"),
        "/usage": this.list("reports:read", "Usage"),
      },
      "x-api-scopes": API_SCOPES,
      "x-rate-limits": {
        credential_per_minute: 60,
        organization_per_minute: 300,
      },
      "x-idempotency-retention-hours": 24,
      "x-hmac-signature": {
        algorithm: "HMAC-SHA256",
        tolerance_seconds: 300,
        canonical_format:
          "<unix timestamp>\\n<uppercase method>\\n<path and query>\\n<sha256 hex of exact body bytes>",
        signature_header: "v1=<lowercase hex digest>",
      },
      "x-mtls":
        "Credentials configured with certificate fingerprints additionally require a CA-validated client certificate.",
      "x-sandbox":
        "Test credentials return simulated results and never call Meta.",
    };
  }

  postman(baseUrl: string) {
    return {
      info: {
        name: "Relay WhatsApp Public API",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      variable: [
        { key: "baseUrl", value: `${baseUrl}/public/v1` },
        { key: "apiKey", value: "YOUR_API_KEY", type: "secret" },
      ],
      auth: {
        type: "bearer",
        bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }],
      },
      item: [
        {
          name: "Send template message",
          request: {
            method: "POST",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "Idempotency-Key", value: "replace-with-unique-key" },
            ],
            url: "{{baseUrl}}/messages/template",
            body: {
              mode: "raw",
              raw: JSON.stringify(
                {
                  to: "+919876543210",
                  sender_id: "SENDER_UUID",
                  template_id: "TEMPLATE_UUID",
                  language: "en_US",
                  parameters: { "1": "Rahul" },
                },
                null,
                2,
              ),
            },
          },
        },
        this.getItem("List templates", "/templates"),
        this.getItem("List campaigns", "/campaigns"),
        this.getItem("Usage", "/usage"),
      ],
    };
  }

  codeSamples(baseUrl: string) {
    const url = `${baseUrl}/public/v1/messages/template`;
    return {
      curl: `curl -X POST '${url}' -H 'Authorization: Bearer YOUR_API_KEY' -H 'Idempotency-Key: UNIQUE_KEY' -H 'Content-Type: application/json' -d '{"to":"+919876543210","sender_id":"SENDER_UUID","template_id":"TEMPLATE_UUID","language":"en_US","parameters":{}}'`,
      oauth: `curl -u 'KEY_PUBLIC_ID:YOUR_API_KEY' -X POST '${baseUrl}/public/oauth/token' -H 'Content-Type: application/json' -d '{"grant_type":"client_credentials","scope":"messages:send"}'`,
      node: `await fetch('${url}', { method: 'POST', headers: { Authorization: 'Bearer YOUR_API_KEY', 'Idempotency-Key': 'UNIQUE_KEY', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });`,
      python: `requests.post('${url}', headers={'Authorization': 'Bearer YOUR_API_KEY', 'Idempotency-Key': 'UNIQUE_KEY'}, json=payload, timeout=15)`,
      php: `$client->post('${url}', ['headers' => ['Authorization' => 'Bearer YOUR_API_KEY', 'Idempotency-Key' => 'UNIQUE_KEY'], 'json' => $payload]);`,
      java: `HttpRequest.newBuilder(URI.create("${url}")).header("Authorization", "Bearer YOUR_API_KEY").header("Idempotency-Key", "UNIQUE_KEY").POST(BodyPublishers.ofString(json)).build();`,
    };
  }

  private postMessage() {
    return {
      post: {
        summary: "Queue an approved template message",
        "x-required-scope": "messages:send",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string", maxLength: 200 },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TemplateMessage" },
            },
          },
        },
        responses: {
          "202": { description: "Accepted for asynchronous processing" },
          "409": { description: "Idempotency conflict" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    };
  }

  private list(scope: string, summary: string) {
    return {
      get: {
        summary,
        "x-required-scope": scope,
        responses: { "200": { description: "Success" } },
      },
    };
  }

  private getById(scope: string, summary: string) {
    return {
      get: {
        summary,
        "x-required-scope": scope,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Success" },
          "404": { description: "Not found" },
        },
      },
    };
  }

  private getItem(name: string, path: string) {
    return { name, request: { method: "GET", url: `{{baseUrl}}${path}` } };
  }
}
