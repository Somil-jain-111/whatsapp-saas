import { ForbiddenException, Injectable } from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { AppConfigService } from "../../../default/config/config.service";
import { WhatsappIntegrationRepository } from "../repositories/whatsapp-integration.repository";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FieldEncryptionService } from "../../security/encryption/field-encryption.service";

interface SanitizedChange {
  field: string;
  value: Record<string, any>;
}

interface SanitizedEntry {
  id?: string;
  changes: SanitizedChange[];
}

@Injectable()
export class MetaWebhookService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repository: WhatsappIntegrationRepository,
    private readonly events: EventEmitter2,
    private readonly encryption: FieldEncryptionService,
  ) {}

  verifyChallenge(mode: string, token: string, challenge: string): string {
    if (
      mode !== "subscribe" ||
      !this.same(token, this.required("META_WEBHOOK_VERIFY_TOKEN"))
    ) {
      throw new ForbiddenException();
    }
    return challenge;
  }

  async verifyTenantChallenge(
    webhookKey: string,
    mode: string,
    token: string,
    challenge: string,
  ): Promise<string> {
    const value = await this.tenantWebhookSecrets(webhookKey);
    if (mode !== "subscribe" || !this.same(token, value.webhookVerifyToken))
      throw new ForbiddenException();
    return challenge;
  }

  async receive(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!rawBody || !signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) {
      throw new ForbiddenException("Invalid webhook signature");
    }
    const expected = `sha256=${createHmac(
      "sha256",
      this.required("META_APP_SECRET"),
    )
      .update(rawBody)
      .digest("hex")}`;
    if (!this.same(signature.toLowerCase(), expected)) {
      throw new ForbiddenException("Invalid webhook signature");
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new ForbiddenException("Invalid webhook payload");
    }
    const sanitized = await this.sanitize(body);
    const retentionDays = this.config.get<number>(
      "META_WEBHOOK_RETENTION_DAYS",
      30,
    );
    const saved = await this.repository.saveWebhook(
      createHash("sha256").update(rawBody).digest("hex"),
      sanitized,
      new Date(Date.now() + retentionDays * 86400000),
    );
    return { eventId: saved.id, duplicate: !saved.created };
  }

  async receiveTenant(
    webhookKey: string,
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ) {
    if (!rawBody || !signature || !/^sha256=[0-9a-f]{64}$/i.test(signature))
      throw new ForbiddenException("Invalid webhook signature");
    const value = await this.tenantWebhookSecrets(webhookKey);
    const expected = `sha256=${createHmac("sha256", value.appSecret)
      .update(rawBody)
      .digest("hex")}`;
    if (!this.same(signature.toLowerCase(), expected))
      throw new ForbiddenException("Invalid webhook signature");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    } catch {
      throw new ForbiddenException("Invalid webhook payload");
    }
    const sanitized = await this.sanitize(body);
    const retentionDays = this.config.get<number>(
      "META_WEBHOOK_RETENTION_DAYS",
      30,
    );
    const saved = await this.repository.saveWebhook(
      createHash("sha256").update(rawBody).digest("hex"),
      sanitized,
      new Date(Date.now() + retentionDays * 86400000),
      value.organizationId,
    );
    return { eventId: saved.id, duplicate: !saved.created };
  }

  async process(eventId: string): Promise<void> {
    const event = await this.repository.getWebhook(eventId);
    if (!event || event.status === "PROCESSED") return;
    const entries = Array.isArray(event.payload.entry)
      ? (event.payload.entry as SanitizedEntry[])
      : [];
    let handled = false;
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        if (
          change.field === "messages" &&
          Array.isArray(change.value.messages)
        ) {
          for (const status of change.value.messages) {
            if (status.inbound) {
              const inbound = JSON.parse(
                (
                  await this.encryption.decrypt(
                    {
                      ciphertext: Buffer.from(
                        status.inbound.ciphertext,
                        "base64",
                      ),
                      nonce: Buffer.from(status.inbound.nonce, "base64"),
                      authTag: Buffer.from(status.inbound.authTag, "base64"),
                      keyVersion: status.inbound.keyVersion,
                    },
                    "meta-webhook-inbound",
                  )
                ).toString("utf8"),
              );
              const results = await this.events.emitAsync("inbox.inbound", {
                ...inbound,
                providerPhoneId: String(
                  change.value.provider_phone_number_id ?? "",
                ),
                profileName: change.value.profile_name
                  ? String(change.value.profile_name)
                  : undefined,
              });
              handled = results.length > 0 || handled;
              continue;
            }
            const providerId = String(status.id ?? "");
            const rawStatus = String(status.status ?? "").toUpperCase();
            if (
              !providerId ||
              !["SENT", "DELIVERED", "READ", "FAILED"].includes(rawStatus)
            )
              continue;
            const error = Array.isArray(status.errors)
              ? status.errors[0]
              : undefined;
            const applied = await this.repository.applyMessageStatus({
              providerMessageId: providerId,
              status: rawStatus,
              rawStatus,
              providerTimestamp: status.timestamp
                ? new Date(Number(status.timestamp) * 1000)
                : null,
              deduplicationKey: createHash("sha256")
                .update(`${providerId}:${rawStatus}:${status.timestamp ?? ""}`)
                .digest("hex"),
              errorCode: error?.code ? String(error.code).slice(0, 100) : null,
              errorDescription: error?.title
                ? String(error.title).slice(0, 500)
                : null,
            });
            if (applied) {
              handled = true;
              if (applied.conversationId)
                this.events.emit("inbox.outbound.status", {
                  organizationId: applied.organizationId,
                  conversationId: applied.conversationId,
                  messageId: applied.messageId,
                  status: applied.status,
                });
              this.events.emit("developer.webhook", {
                organizationId: applied.organizationId,
                eventType: `message.${applied.status.toLowerCase()}`,
                payload: {
                  message_id: applied.messageId,
                  status: applied.status,
                },
              });
              if (applied.campaignCompleted)
                this.events.emit("developer.webhook", {
                  organizationId: applied.organizationId,
                  eventType: "campaign.completed",
                  payload: {
                    campaign_id: applied.campaignId,
                    status: "COMPLETED",
                  },
                });
            }
          }
          continue;
        }
        if (!change.field.includes("message_template")) continue;
        const id = String(
          change.value.message_template_id ?? change.value.id ?? "",
        );
        const rawStatus = String(
          change.value.event ?? change.value.status ?? "",
        );
        if (!id || !rawStatus) continue;
        handled =
          (await this.repository.applyTemplateWebhook(
            eventId,
            id,
            rawStatus,
            this.normalizeStatus(rawStatus),
            typeof change.value.reason === "string"
              ? change.value.reason
              : null,
          )) || handled;
      }
    }
    await this.repository.finishWebhook(
      eventId,
      handled ? "PROCESSED" : "IGNORED",
    );
  }

  private async sanitize(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const allowed = new Set([
      "id",
      "message_template_id",
      "message_template_name",
      "message_template_language",
      "event",
      "status",
      "reason",
      "quality_score",
      "phone_number_id",
    ]);
    return {
      object: typeof body.object === "string" ? body.object : "unknown",
      entry: await Promise.all(
        entries.map(async (rawEntry) => {
          const entry = (rawEntry ?? {}) as Record<string, unknown>;
          const changes = Array.isArray(entry.changes) ? entry.changes : [];
          return {
            id: typeof entry.id === "string" ? entry.id : undefined,
            changes: await Promise.all(
              changes.map(async (rawChange) => {
                const change = (rawChange ?? {}) as Record<string, unknown>;
                const value = (change.value ?? {}) as Record<string, unknown>;
                const messages = Array.isArray(value.messages)
                  ? await Promise.all(
                      value.messages.slice(0, 1000).map(async (item: any) => {
                        if (
                          typeof item?.from === "string" &&
                          typeof item?.type === "string"
                        ) {
                          const media = item[item.type] ?? {};
                          const interactiveReply =
                            item.type === "interactive"
                              ? (item.interactive?.button_reply ??
                                item.interactive?.list_reply)
                              : undefined;
                          const payload = {
                            providerMessageId: String(item.id ?? ""),
                            from: item.from,
                            timestamp: new Date(Number(item.timestamp) * 1000),
                            type: String(item.type).toUpperCase(),
                            text:
                              item.type === "text"
                                ? String(item.text?.body ?? "").slice(0, 4096)
                                : interactiveReply?.id
                                  ? String(interactiveReply.id).slice(0, 4096)
                                  : media.caption
                                    ? String(media.caption).slice(0, 4096)
                                    : undefined,
                            mediaId: media.id ? String(media.id) : undefined,
                            mime: media.mime_type
                              ? String(media.mime_type).slice(0, 100)
                              : undefined,
                            fileName: media.filename
                              ? String(media.filename).slice(0, 255)
                              : undefined,
                            replyTo: item.context?.id
                              ? String(item.context.id).slice(0, 255)
                              : undefined,
                          };
                          const encrypted = await this.encryption.encrypt(
                            Buffer.from(JSON.stringify(payload)),
                            "meta-webhook-inbound",
                          );
                          return {
                            inbound: {
                              ciphertext:
                                encrypted.ciphertext.toString("base64"),
                              nonce: encrypted.nonce.toString("base64"),
                              authTag: encrypted.authTag.toString("base64"),
                              keyVersion: encrypted.keyVersion,
                            },
                          };
                        }
                        return {
                          id:
                            typeof item?.id === "string" ? item.id : undefined,
                          status:
                            typeof item?.status === "string"
                              ? item.status
                              : undefined,
                          timestamp:
                            typeof item?.timestamp === "string"
                              ? item.timestamp
                              : undefined,
                          errors: Array.isArray(item?.errors)
                            ? item.errors
                                .slice(0, 1)
                                .map((error: any) => ({
                                  code: error?.code,
                                  title: error?.title,
                                }))
                            : [],
                        };
                      }),
                    )
                  : undefined;
                return {
                  field:
                    typeof change.field === "string" ? change.field : "unknown",
                  value: {
                    ...Object.fromEntries(
                      Object.entries(value).filter(
                        ([key, item]) =>
                          allowed.has(key) &&
                          ["string", "number", "boolean"].includes(typeof item),
                      ),
                    ),
                    ...(messages ? { messages } : {}),
                    provider_phone_number_id:
                      typeof (value.metadata as any)?.phone_number_id ===
                      "string"
                        ? (value.metadata as any).phone_number_id
                        : typeof value.phone_number_id === "string"
                          ? value.phone_number_id
                          : undefined,
                    profile_name: Array.isArray(value.contacts)
                      ? String(
                          (value.contacts[0] as any)?.profile?.name ?? "",
                        ).slice(0, 150)
                      : undefined,
                  },
                };
              }),
            ),
          };
        }),
      ),
    };
  }

  private normalizeStatus(status: string): string {
    const normalized = status.toUpperCase();
    return ["APPROVED", "REJECTED", "PENDING", "PAUSED", "DISABLED"].includes(
      normalized,
    )
      ? normalized
      : "UNKNOWN";
  }

  private async tenantWebhookSecrets(webhookKey: string): Promise<{
    organizationId: string;
    appSecret: string;
    webhookVerifyToken: string;
  }> {
    const row = await this.repository.appConfigurationByWebhookKey(webhookKey);
    if (
      !row?.secret_ciphertext ||
      !row.secret_nonce ||
      !row.secret_auth_tag ||
      !row.key_version
    )
      throw new ForbiddenException();
    try {
      const value = JSON.parse(
        (
          await this.encryption.decrypt(
            {
              ciphertext: row.secret_ciphertext,
              nonce: row.secret_nonce,
              authTag: row.secret_auth_tag,
              keyVersion: row.key_version,
            },
            `meta-app-config:${row.organization_id}`,
          )
        ).toString("utf8"),
      ) as { appSecret?: string; webhookVerifyToken?: string };
      if (!value.appSecret || !value.webhookVerifyToken)
        throw new Error("Missing webhook secrets");
      return {
        organizationId: row.organization_id,
        appSecret: value.appSecret,
        webhookVerifyToken: value.webhookVerifyToken,
      };
    } catch {
      throw new ForbiddenException();
    }
  }

  private same(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value)
      throw new ForbiddenException("Meta integration is not configured");
    return value;
  }
}
