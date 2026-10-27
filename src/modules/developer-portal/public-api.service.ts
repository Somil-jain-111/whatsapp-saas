import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { RedisService } from "../../default/databases/redis/redis.service";
import { AppConfigService } from "../../default/config/config.service";
import { BusinessException } from "../../default/error/business.exception";
import { ERROR_CODES } from "../../default/error/error.code";
import { AnalyticsService } from "../analytics/analytics.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { MessagingService } from "../messaging/messaging.service";
import { TemplateService } from "../whatsapp-integration/services/template.service";
import { ApiKeyPrincipal } from "./developer-request.interface";
import { DeveloperPortalRepository } from "./developer-portal.repository";
import {
  PublicBulkMessageDto,
  PublicListDto,
  PublicTemplateMessageDto,
} from "./dto/developer-portal.dto";

@Injectable()
export class PublicApiService {
  constructor(
    private readonly repo: DeveloperPortalRepository,
    private readonly messaging: MessagingService,
    private readonly templates: TemplateService,
    private readonly campaigns: CampaignsService,
    private readonly analytics: AnalyticsService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async sendTemplate(
    principal: ApiKeyPrincipal,
    dto: PublicTemplateMessageDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const fingerprint = this.fingerprint(dto);
    const record = await this.repo.claimIdempotency(
      principal.organizationId,
      principal.id,
      "messages.template",
      idempotencyKey,
      fingerprint,
    );
    if (record.request_fingerprint !== fingerprint)
      throw new ConflictException({
        code: "IDEMPOTENCY_CONFLICT",
        message: "The idempotency key was already used with another payload.",
      });
    if (record.status === "COMPLETED") return record.response_body;
    if (!record.created && record.status === "PROCESSING")
      throw new ConflictException({
        code: "IDEMPOTENCY_IN_PROGRESS",
        message: "An identical request is still processing.",
      });
    if (record.status !== "PROCESSING")
      throw new ServiceUnavailableException({
        code: "RETRY_REQUEST",
        message: "The previous attempt did not finish. Retry with a new key.",
      });

    try {
      const result =
        principal.environment === "TEST"
          ? {
              message_id: randomUUID(),
              status: "QUEUED",
              simulated: true,
              scenario: dto.scenario,
            }
          : await this.sendLive(principal, dto, idempotencyKey);
      await this.repo.finishIdempotency(
        principal.organizationId,
        record.id,
        202,
        result,
      );
      return result;
    } catch (error) {
      await this.repo.failIdempotency(principal.organizationId, record.id);
      throw error;
    }
  }

  async sendBulk(
    principal: ApiKeyPrincipal,
    dto: PublicBulkMessageDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const counter = `public-api:bulk:${principal.organizationId}`;
    const concurrent = await this.redis.incrementWithExpiry(counter, 300);
    if (concurrent > 2) {
      await this.redis.client.decr(counter);
      throw new ConflictException({
        code: "BULK_CONCURRENCY_EXCEEDED",
        message: "Too many bulk operations are running.",
      });
    }
    try {
      const jobs = [];
      for (let index = 0; index < dto.messages.length; index += 1)
        jobs.push(
          await this.sendTemplate(
            principal,
            dto.messages[index],
            `${idempotencyKey}:${index}`,
          ),
        );
      return { accepted: jobs.length, messages: jobs };
    } finally {
      await this.redis.client.decr(counter);
    }
  }

  async getMessage(principal: ApiKeyPrincipal, id: string) {
    if (principal.environment === "TEST") {
      const message = await this.repo.sandboxMessage(
        principal.organizationId,
        principal.id,
        id,
      );
      if (!message) throw new NotFoundException("Sandbox message not found");
      const scenario = message.response_body.scenario;
      return {
        id,
        status:
          scenario === "failed"
            ? "FAILED"
            : scenario === "read"
              ? "READ"
              : "DELIVERED",
        scenario,
        simulated: true,
        created_at: message.created_at,
      };
    }
    return this.messaging.get(principal.organizationId, id);
  }

  templatesList(principal: ApiKeyPrincipal, limit = 25) {
    if (principal.environment === "TEST")
      return [
        {
          id: "00000000-0000-4000-8000-000000000101",
          name: "sandbox_order_confirmation",
          language: "en_US",
          category: "UTILITY",
          metaStatus: "APPROVED",
          simulated: true,
        },
      ];
    return this.templates.list(principal.organizationId, limit);
  }

  template(principal: ApiKeyPrincipal, id: string) {
    if (principal.environment === "TEST")
      return {
        id,
        name: "sandbox_order_confirmation",
        language: "en_US",
        category: "UTILITY",
        simulated: true,
      };
    return this.templates.get(principal.organizationId, id);
  }

  campaignsList(principal: ApiKeyPrincipal, query: PublicListDto) {
    return this.campaigns.list(principal.organizationId, {
      ...query,
      status: undefined,
    });
  }

  campaign(principal: ApiKeyPrincipal, id: string) {
    return this.campaigns.get(principal.organizationId, id);
  }

  reports(principal: ApiKeyPrincipal) {
    return this.analytics.overview(principal.organizationId, {
      start: undefined,
      end: undefined,
      senderId: undefined,
      campaignId: undefined,
      templateId: undefined,
    });
  }

  usage(principal: ApiKeyPrincipal) {
    return this.repo.publicUsage(principal.organizationId);
  }

  private assertIdempotencyKey(value?: string): asserts value is string {
    if (!value || value.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(value))
      throw new BusinessException(
        ERROR_CODES.DEVELOPER.IDEMPOTENCY_KEY_REQUIRED,
      );
  }

  private async sendLive(
    principal: ApiKeyPrincipal,
    dto: PublicTemplateMessageDto,
    idempotencyKey: string,
  ) {
    const minute = Math.floor(Date.now() / 60000);
    const senderCount = await this.redis.incrementWithExpiry(
      `public-api:sender:${dto.sender_id}:${minute}`,
      65,
    );
    if (
      senderCount >
      this.config.get<number>("PUBLIC_API_SENDER_RATE_PER_MINUTE", 80)
    )
      throw new ConflictException({
        code: "SENDER_THROUGHPUT_EXCEEDED",
        message: "Sender throughput limit exceeded.",
      });
    const day = new Date().toISOString().slice(0, 10);
    const dailyCount = await this.redis.incrementWithExpiry(
      `public-api:messages:${principal.organizationId}:${day}`,
      90000,
    );
    if (
      dailyCount >
      this.config.get<number>("PUBLIC_API_DAILY_MESSAGE_LIMIT", 10000)
    )
      throw new ConflictException({
        code: "DAILY_MESSAGE_QUOTA_EXCEEDED",
        message: "Daily public API message quota exceeded.",
      });
    const operationKey = `public:${principal.id}:${idempotencyKey}`;
    const spending = await this.repo.reserveMessageSpend(
      principal.organizationId,
      principal.id,
      operationKey,
      dto.to,
      dto.template_id,
    );
    if (spending.priceUnavailable)
      throw new ConflictException({
        code: "MESSAGE_PRICE_UNAVAILABLE",
        message:
          "The configured spending cap cannot be evaluated for this message.",
      });
    if (spending.exceeded)
      throw new HttpException(
        {
          code: "SPENDING_CAP_EXCEEDED",
          message: "The monthly API messaging spending cap has been reached.",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    try {
      const message = await this.messaging.send(principal.organizationId, {
        recipientPhone: dto.to,
        senderId: dto.sender_id,
        templateId: dto.template_id,
        language: dto.language,
        parameters: dto.parameters,
        idempotencyKey: operationKey,
      });
      if (spending.reservation?.status === "RESERVED")
        await this.repo.finishSpendReservation(
          principal.organizationId,
          spending.reservation.id,
          true,
        );
      return { message_id: message.id, status: message.status };
    } catch (error) {
      if (spending.reservation?.status === "RESERVED")
        await this.repo.finishSpendReservation(
          principal.organizationId,
          spending.reservation.id,
          false,
        );
      throw error;
    }
  }

  private fingerprint(value: unknown) {
    return createHash("sha256").update(this.canonical(value)).digest("hex");
  }

  private canonical(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.map((item) => this.canonical(item)).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${this.canonical(item)}`)
        .join(",")}}`;
    return JSON.stringify(value);
  }
}
