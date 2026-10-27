import { InjectQueue } from "@nestjs/bullmq";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { createHmac, randomBytes, randomUUID } from "crypto";
import { Queue } from "bullmq";
import { firstValueFrom } from "rxjs";
import { OnEvent } from "@nestjs/event-emitter";
import { Agent } from "https";
import { AuditRepository } from "../audit/audit.repository";
import { TenantContextService } from "../database/tenant-context.service";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { CreateWebhookDto } from "./dto/developer-portal.dto";
import { WebhookDestinationPolicy } from "./webhook-destination.policy";

export const DEVELOPER_WEBHOOK_QUEUE = "developer-webhook";

@Injectable()
export class DeveloperWebhookService implements OnModuleInit {
  constructor(
    private readonly tenants: TenantContextService,
    private readonly encryption: FieldEncryptionService,
    private readonly destinations: WebhookDestinationPolicy,
    private readonly http: HttpService,
    private readonly audit: AuditRepository,
    @InjectQueue(DEVELOPER_WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    await this.queue.add(
      "retention-cleanup",
      {},
      {
        jobId: "developer-retention-cleanup",
        repeat: { every: 86400000 },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }

  cleanup() {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      await manager.query(
        `DELETE FROM whatsapp_core.api_request_logs WHERE expires_at<now()`,
      );
      await manager.query(
        `DELETE FROM whatsapp_core.api_security_events WHERE expires_at<now()`,
      );
      await manager.query(
        `DELETE FROM whatsapp_core.developer_webhook_deliveries WHERE expires_at<now()`,
      );
      await manager.query(
        `DELETE FROM whatsapp_core.public_idempotency_records WHERE expires_at<now()`,
      );
    });
  }

  list(org: string) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `SELECT e.id,e.name,e.url,e.status,e.consecutive_failures,e.disabled_at,e.created_at,
          coalesce(array_agg(s.event_type) FILTER(WHERE s.event_type IS NOT NULL),'{}') events
         FROM whatsapp_core.developer_webhook_endpoints e LEFT JOIN whatsapp_core.developer_webhook_subscriptions s ON s.endpoint_id=e.id
         WHERE e.organization_id=$1 GROUP BY e.id ORDER BY e.created_at DESC`,
        [org],
      ),
    );
  }

  @OnEvent("developer.webhook", { async: true })
  async onPlatformEvent(event: {
    organizationId: string;
    eventType: string;
    payload: unknown;
  }) {
    const deliveries = await this.tenants.run(
      event.organizationId,
      async (manager) => {
        const endpoints = await manager.query(
          `SELECT e.id FROM whatsapp_core.developer_webhook_endpoints e
           JOIN whatsapp_core.developer_webhook_subscriptions s ON s.endpoint_id=e.id
           WHERE e.organization_id=$1 AND e.status='ACTIVE' AND s.event_type=$2`,
          [event.organizationId, event.eventType],
        );
        const rows = [];
        const eventId = randomUUID();
        for (const endpoint of endpoints)
          rows.push(
            (
              await manager.query(
                `INSERT INTO whatsapp_core.developer_webhook_deliveries(organization_id,endpoint_id,event_id,event_type,payload)
                 VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
                [
                  event.organizationId,
                  endpoint.id,
                  eventId,
                  event.eventType,
                  JSON.stringify(event.payload),
                ],
              )
            )[0],
          );
        return rows.filter(Boolean);
      },
    );
    for (const delivery of deliveries)
      await this.enqueue(delivery.id, event.organizationId);
  }

  async create(org: string, user: string, dto: CreateWebhookDto) {
    await this.destinations.assertPublicHttps(dto.url);
    const secret = `whsec_${randomBytes(32).toString("base64url")}`;
    const endpoint = await this.tenants.run(org, async (manager) => {
      const id = randomUUID();
      const encrypted = await this.encryption.encrypt(
        Buffer.from(secret),
        `developer-webhook:${org}:${id}`,
      );
      const [row] = await manager.query(
        `INSERT INTO whatsapp_core.developer_webhook_endpoints
          (id,organization_id,name,url,secret_ciphertext,secret_nonce,secret_auth_tag,key_version,created_by_user_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,url,status,created_at`,
        [
          id,
          org,
          dto.name,
          dto.url,
          encrypted.ciphertext,
          encrypted.nonce,
          encrypted.authTag,
          encrypted.keyVersion,
          user,
        ],
      );
      for (const event of dto.events)
        await manager.query(
          `INSERT INTO whatsapp_core.developer_webhook_subscriptions(endpoint_id,organization_id,event_type) VALUES($1,$2,$3)`,
          [id, org, event],
        );
      return { ...row, events: dto.events };
    });
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.webhook.created",
      resourceType: "developer_webhook",
      resourceId: endpoint.id,
      metadata: { url: dto.url, events: dto.events },
    });
    return { ...endpoint, signingSecret: secret };
  }

  async rotate(org: string, user: string, id: string) {
    const secret = `whsec_${randomBytes(32).toString("base64url")}`;
    const encrypted = await this.encryption.encrypt(
      Buffer.from(secret),
      `developer-webhook:${org}:${id}`,
    );
    const updated = await this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.developer_webhook_endpoints SET secret_ciphertext=$3,secret_nonce=$4,secret_auth_tag=$5,key_version=$6,updated_at=now()
           WHERE organization_id=$1 AND id=$2 AND status<>'REVOKED' RETURNING id`,
            [
              org,
              id,
              encrypted.ciphertext,
              encrypted.nonce,
              encrypted.authTag,
              encrypted.keyVersion,
            ],
          )
        )[0],
    );
    if (!updated) throw new NotFoundException("Webhook endpoint not found");
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.webhook.secret_rotated",
      resourceType: "developer_webhook",
      resourceId: id,
      metadata: {},
    });
    return { id, signingSecret: secret };
  }

  deliveries(org: string, endpointId: string) {
    return this.tenants.run(org, (manager) =>
      manager.query(
        `SELECT id,event_id,event_type,status,attempt_count,response_status,error_code,next_attempt_at,delivered_at,created_at
         FROM whatsapp_core.developer_webhook_deliveries WHERE organization_id=$1 AND endpoint_id=$2 ORDER BY created_at DESC LIMIT 100`,
        [org, endpointId],
      ),
    );
  }

  async test(org: string, endpointId: string, eventType: string) {
    const delivery = await this.createDelivery(org, endpointId, eventType, {
      test: true,
      message_id: randomUUID(),
    });
    await this.enqueue(delivery.id, org);
    return delivery;
  }

  async replay(org: string, deliveryId: string) {
    const delivery = await this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.developer_webhook_deliveries SET status='PENDING',attempt_count=0,next_attempt_at=now(),error_code=NULL,updated_at=now()
           WHERE organization_id=$1 AND id=$2 AND status IN ('FAILED','DEAD') RETURNING id`,
            [org, deliveryId],
          )
        )[0],
    );
    if (!delivery)
      throw new ConflictException("Only failed deliveries can be replayed");
    await this.enqueue(delivery.id, org);
    return delivery;
  }

  async deliver(org: string, deliveryId: string) {
    const context = await this.tenants.run(
      org,
      async (manager) =>
        (
          await manager.query(
            `UPDATE whatsapp_core.developer_webhook_deliveries d SET attempt_count=attempt_count+1,updated_at=now()
           FROM whatsapp_core.developer_webhook_endpoints e
           WHERE d.organization_id=$1 AND d.id=$2 AND e.id=d.endpoint_id AND e.status='ACTIVE' AND d.status IN ('PENDING','FAILED')
           RETURNING d.*,e.url,e.secret_ciphertext,e.secret_nonce,e.secret_auth_tag,e.key_version`,
            [org, deliveryId],
          )
        )[0],
    );
    if (!context) return;
    const destination = await this.destinations.assertPublicHttps(context.url);
    const pinned = destination.addresses[0];
    const httpsAgent = new Agent({
      lookup: (_hostname, _options, callback) =>
        callback(null, pinned.address, pinned.family as 4 | 6),
    });
    const secret = (
      await this.encryption.decrypt(
        {
          ciphertext: context.secret_ciphertext,
          nonce: context.secret_nonce,
          authTag: context.secret_auth_tag,
          keyVersion: context.key_version,
        },
        `developer-webhook:${org}:${context.endpoint_id}`,
      )
    ).toString("utf8");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      id: context.event_id,
      type: context.event_type,
      created_at: context.created_at,
      data: context.payload,
    });
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    try {
      const response = await firstValueFrom(
        this.http.post(context.url, body, {
          timeout: 10000,
          maxRedirects: 0,
          httpsAgent,
          validateStatus: (status) => status >= 200 && status < 300,
          headers: {
            "content-type": "application/json",
            "x-relay-event-id": context.event_id,
            "x-relay-timestamp": timestamp,
            "x-relay-signature": `v1=${signature}`,
          },
        }),
      );
      await this.finish(org, context, true, response.status);
    } catch (error: any) {
      await this.finish(org, context, false, error?.response?.status);
      throw error;
    }
  }

  private createDelivery(
    org: string,
    endpointId: string,
    eventType: string,
    payload: unknown,
  ) {
    return this.tenants.run(org, async (manager) => {
      const [endpoint] = await manager.query(
        `SELECT 1 FROM whatsapp_core.developer_webhook_endpoints e JOIN whatsapp_core.developer_webhook_subscriptions s ON s.endpoint_id=e.id
         WHERE e.organization_id=$1 AND e.id=$2 AND e.status='ACTIVE' AND s.event_type=$3`,
        [org, endpointId, eventType],
      );
      if (!endpoint)
        throw new NotFoundException("Active subscribed endpoint not found");
      return (
        await manager.query(
          `INSERT INTO whatsapp_core.developer_webhook_deliveries(organization_id,endpoint_id,event_id,event_type,payload)
           VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id,event_id,event_type,status,created_at`,
          [org, endpointId, randomUUID(), eventType, JSON.stringify(payload)],
        )
      )[0];
    });
  }

  private enqueue(id: string, org: string) {
    return this.queue.add(
      "deliver",
      { id, organizationId: org },
      {
        jobId: `developer-webhook-${id}`,
        attempts: 6,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );
  }

  private finish(
    org: string,
    context: any,
    success: boolean,
    responseStatus?: number,
  ) {
    return this.tenants.run(org, async (manager) => {
      await manager.query(
        `UPDATE whatsapp_core.developer_webhook_deliveries SET status=$3,response_status=$4,error_code=$5,
          delivered_at=CASE WHEN $3='DELIVERED' THEN now() ELSE NULL END,
          next_attempt_at=CASE WHEN $3='FAILED' THEN now()+least(interval '2 seconds'*power(2,attempt_count),interval '1 hour') ELSE next_attempt_at END,updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [
          org,
          context.id,
          success
            ? "DELIVERED"
            : context.attempt_count >= 6
              ? "DEAD"
              : "FAILED",
          responseStatus ?? null,
          success ? null : "DELIVERY_FAILED",
        ],
      );
      await manager.query(
        `UPDATE whatsapp_core.developer_webhook_endpoints SET
          consecutive_failures=CASE WHEN $3 THEN 0 ELSE consecutive_failures+1 END,
          status=CASE WHEN NOT $3 AND consecutive_failures+1>=10 THEN 'DISABLED' ELSE status END,
          disabled_at=CASE WHEN NOT $3 AND consecutive_failures+1>=10 THEN now() ELSE disabled_at END,updated_at=now()
         WHERE organization_id=$1 AND id=$2`,
        [org, context.endpoint_id, success],
      );
    });
  }
}
