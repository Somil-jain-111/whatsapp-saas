import {
  ConflictException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConversationsService } from "./conversations.service";

function setup(overrides: Record<string, unknown> = {}) {
  const repo = {
    get: jest.fn().mockResolvedValue({
      id: "conversation",
      contact_id: "contact",
      sender_id: "sender",
      phone_e164: "+919876543210",
      service_window_expires_at: new Date(Date.now() + 60_000),
      assigned_user_id: null,
    }),
    inbound: jest.fn().mockResolvedValue({ messageId: "message" }),
    ...overrides,
  };
  const encryption = {
    encrypt: jest.fn().mockResolvedValue({
      ciphertext: Buffer.from("cipher"),
      nonce: Buffer.from("nonce"),
      authTag: Buffer.from("tag"),
      keyVersion: "v1",
    }),
  };
  const messaging = {
    sendConversationReply: jest.fn().mockResolvedValue({ id: "message" }),
  };
  const storage = { putBuffer: jest.fn() };
  const service = new ConversationsService(
    repo as never,
    encryption as never,
    messaging as never,
    storage as never,
    {} as never,
    { append: jest.fn() } as never,
    { downloadMedia: jest.fn() } as never,
    { emit: jest.fn() } as never,
  );
  return { service, repo, messaging, storage };
}

describe("ConversationsService", () => {
  it("queues free-form replies inside the customer-service window", async () => {
    const { service, messaging } = setup();
    await expect(
      service.reply("org", "conversation", "agent", {
        type: "TEXT",
        text: "Hello",
        parameters: {},
        idempotencyKey: "request-1",
      }),
    ).resolves.toEqual({ id: "message" });
    expect(messaging.sendConversationReply).toHaveBeenCalledWith(
      "org",
      expect.objectContaining({ type: "TEXT", conversationId: "conversation" }),
    );
  });

  it("validates and queues interactive button replies inside the service window", async () => {
    const { service, messaging } = setup();
    await service.reply("org", "conversation", "agent", {
      type: "INTERACTIVE",
      interactive: {
        type: "BUTTON",
        body: "Choose",
        buttons: [{ id: "support", title: "Support" }],
      },
      parameters: {},
      idempotencyKey: "request-interactive",
    });
    expect(messaging.sendConversationReply).toHaveBeenCalledWith(
      "org",
      expect.objectContaining({
        type: "INTERACTIVE",
        interactive: expect.objectContaining({ type: "BUTTON" }),
      }),
    );
  });

  it("requires an approved template outside the customer-service window", async () => {
    const { service, messaging } = setup({
      get: jest.fn().mockResolvedValue({
        contact_id: "contact",
        sender_id: "sender",
        phone_e164: "+919876543210",
        service_window_expires_at: new Date(Date.now() - 60_000),
        assigned_user_id: null,
      }),
    });
    await expect(
      service.reply("org", "conversation", "agent", {
        type: "TEXT",
        text: "Hello",
        parameters: {},
        idempotencyKey: "request-2",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(messaging.sendConversationReply).not.toHaveBeenCalled();
  });

  it("prevents a different agent from replying to an assigned conversation", async () => {
    const { service } = setup({
      get: jest.fn().mockResolvedValue({ assigned_user_id: "other-agent" }),
    });
    await expect(
      service.reply("org", "conversation", "agent", {
        type: "TEXT",
        text: "Hello",
        parameters: {},
        idempotencyKey: "request-3",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a media object from another tenant or conversation", async () => {
    const { service, messaging } = setup();
    await expect(
      service.reply("org", "conversation", "agent", {
        type: "IMAGE",
        mediaObjectKey: "inbox/another-org/conversation/file",
        mediaMimeType: "image/jpeg",
        mediaFileName: "photo.jpg",
        parameters: {},
        idempotencyKey: "request-4",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(messaging.sendConversationReply).not.toHaveBeenCalled();
  });

  it("validates file signatures before private media storage", async () => {
    const { service, storage } = setup();
    const file = {
      size: 4,
      buffer: Buffer.from("evil"),
      mimetype: "image/jpeg",
      originalname: "image.jpg",
    } as Express.Multer.File;
    await expect(
      service.upload("org", "conversation", file),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(storage.putBuffer).not.toHaveBeenCalled();
  });

  it("accepts interactive replies and normalizes provider timestamps", async () => {
    const { service, repo } = setup();
    await service.inbound({
      providerPhoneId: "phone",
      providerMessageId: "wamid",
      from: "9198",
      timestamp: "2026-10-18T10:00:00.000Z" as never,
      type: "interactive",
      text: "value",
    });
    expect(repo.inbound).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "INTERACTIVE",
        timestamp: new Date("2026-10-18T10:00:00.000Z"),
      }),
    );
  });
});
