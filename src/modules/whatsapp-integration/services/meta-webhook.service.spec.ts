import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "crypto";
import { MetaWebhookService } from "./meta-webhook.service";

const secret = "meta-app-secret-at-least-16";

function service() {
  const repository = {
    saveWebhook: jest.fn().mockResolvedValue({ id: "event-id", created: true }),
    getWebhook: jest.fn(),
    applyMessageStatus: jest.fn(),
    finishWebhook: jest.fn(),
    appConfigurationByWebhookKey: jest.fn(),
  };
  const config = {
    get: jest.fn((name: string, fallback?: unknown) => {
      if (name === "META_APP_SECRET") return secret;
      if (name === "META_WEBHOOK_VERIFY_TOKEN")
        return "verification-token-that-is-long-enough";
      return fallback;
    }),
  };
  const events = {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
  };
  const encryption = {
    encrypt: jest.fn().mockResolvedValue({
      ciphertext: Buffer.from("encrypted"),
      nonce: Buffer.from("nonce"),
      authTag: Buffer.from("tag"),
      keyVersion: "v1",
    }),
    decrypt: jest.fn(),
  };
  return {
    repository,
    events,
    encryption,
    value: new MetaWebhookService(
      config as never,
      repository as never,
      events as never,
      encryption as never,
    ),
  };
}

describe("MetaWebhookService", () => {
  it("accepts a valid signature and persists only an allow-listed payload", async () => {
    const { value, repository } = service();
    const raw = Buffer.from(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba",
            changes: [
              {
                field: "message_template_status_update",
                value: {
                  message_template_id: "123",
                  event: "APPROVED",
                  access_token: "must-not-persist",
                },
              },
            ],
          },
        ],
      }),
    );
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

    await expect(value.receive(raw, signature)).resolves.toEqual({
      eventId: "event-id",
      duplicate: false,
    });
    const persisted = repository.saveWebhook.mock.calls[0][1];
    expect(JSON.stringify(persisted)).not.toContain("access_token");
    expect(JSON.stringify(persisted)).toContain("APPROVED");
  });

  it("rejects a forged signature", async () => {
    const { value } = service();
    await expect(
      value.receive(Buffer.from("{}"), `sha256=${"0".repeat(64)}`),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("verifies tenant webhook signatures with the encrypted tenant app secret", async () => {
    const { value, repository, encryption } = service();
    repository.appConfigurationByWebhookKey.mockResolvedValue({
      organization_id: "00000000-0000-4000-8000-000000000001",
      secret_ciphertext: Buffer.from("ciphertext"),
      secret_nonce: Buffer.alloc(12),
      secret_auth_tag: Buffer.alloc(16),
      key_version: "v1",
    });
    encryption.decrypt.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          appSecret: secret,
          webhookVerifyToken: "tenant-webhook-verification-token-12345",
        }),
      ),
    );
    const raw = Buffer.from(JSON.stringify({ object: "whatsapp_business_account" }));
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

    await expect(value.receiveTenant("webhook-key", raw, signature)).resolves.toEqual({
      eventId: "event-id",
      duplicate: false,
    });
    expect(repository.saveWebhook).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Date),
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("reconciles sanitized message delivery statuses", async () => {
    const { value, repository } = service();
    repository.getWebhook = jest.fn().mockResolvedValue({
      status: "PENDING",
      payload: {
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  messages: [
                    {
                      id: "wamid.1",
                      status: "delivered",
                      timestamp: "1792300000",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    repository.applyMessageStatus = jest.fn().mockResolvedValue({
      organizationId: "00000000-0000-4000-8000-000000000001",
      messageId: "00000000-0000-4000-8000-000000000002",
      status: "DELIVERED",
    });
    repository.finishWebhook = jest.fn().mockResolvedValue(undefined);

    await value.process("event-id");

    expect(repository.applyMessageStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        providerMessageId: "wamid.1",
        status: "DELIVERED",
      }),
    );
    expect(repository.finishWebhook).toHaveBeenCalledWith(
      "event-id",
      "PROCESSED",
    );
  });

  it("encrypts inbound message content before durable webhook storage", async () => {
    const { value, repository } = service();
    const raw = Buffer.from(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "provider-phone" },
                  contacts: [{ profile: { name: "Customer" } }],
                  messages: [
                    {
                      id: "wamid.2",
                      from: "919876543210",
                      timestamp: "1792300000",
                      type: "text",
                      text: { body: "private text" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

    await value.receive(raw, signature);

    const persisted = repository.saveWebhook.mock.calls[0][1];
    expect(JSON.stringify(persisted)).not.toContain("private text");
    expect(JSON.stringify(persisted)).toContain(
      Buffer.from("encrypted").toString("base64"),
    );
  });

  it("preserves an interactive reply ID for chatbot matching", async () => {
    const { value, encryption } = service();
    const raw = Buffer.from(
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  metadata: { phone_number_id: "provider-phone" },
                  messages: [
                    {
                      id: "wamid.interactive",
                      from: "919876543210",
                      timestamp: "1792300000",
                      type: "interactive",
                      interactive: {
                        type: "button_reply",
                        button_reply: { id: "support", title: "Support" },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;

    await value.receive(raw, signature);

    expect(JSON.parse(encryption.encrypt.mock.calls[0][0].toString())).toEqual(
      expect.objectContaining({ type: "INTERACTIVE", text: "support" }),
    );
  });

  it("publishes decrypted inbound messages before marking the event processed", async () => {
    const { value, repository, events, encryption } = service();
    repository.getWebhook.mockResolvedValue({
      status: "PENDING",
      payload: {
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  provider_phone_number_id: "provider-phone",
                  messages: [
                    {
                      inbound: {
                        ciphertext: Buffer.from("x").toString("base64"),
                        nonce: Buffer.from("n").toString("base64"),
                        authTag: Buffer.from("t").toString("base64"),
                        keyVersion: "v1",
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });
    encryption.decrypt.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          providerMessageId: "wamid.3",
          from: "9198",
          timestamp: "2026-10-18T10:00:00.000Z",
          type: "TEXT",
          text: "Hello",
        }),
      ),
    );
    events.emitAsync.mockResolvedValue([{ messageId: "message" }]);

    await value.process("event-id");

    expect(events.emitAsync).toHaveBeenCalledWith(
      "inbox.inbound",
      expect.objectContaining({
        providerMessageId: "wamid.3",
        providerPhoneId: "provider-phone",
      }),
    );
    expect(repository.finishWebhook).toHaveBeenCalledWith(
      "event-id",
      "PROCESSED",
    );
  });
});
