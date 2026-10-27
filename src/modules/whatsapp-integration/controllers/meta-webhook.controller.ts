import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Request } from "express";
import { MetaWebhookService } from "../services/meta-webhook.service";
import { META_WEBHOOK_QUEUE } from "../services/meta-webhook.processor";

@Controller("webhooks/meta")
export class MetaWebhookController {
  constructor(
    private readonly webhooks: MetaWebhookService,
    @InjectQueue(META_WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  @Get()
  verify(
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    return this.webhooks.verifyChallenge(mode, token, challenge);
  }

  @Get(":webhookKey")
  verifyTenant(
    @Param("webhookKey", ParseUUIDPipe) webhookKey: string,
    @Query("hub.mode") mode: string,
    @Query("hub.verify_token") token: string,
    @Query("hub.challenge") challenge: string,
  ) {
    return this.webhooks.verifyTenantChallenge(
      webhookKey,
      mode,
      token,
      challenge,
    );
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers("x-hub-signature-256") signature?: string,
  ) {
    const result = await this.webhooks.receive(request.rawBody, signature);
    if (result.eventId) {
      await this.queue.add(
        "process",
        { eventId: result.eventId },
        {
          jobId: result.eventId,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
    return { received: true };
  }

  @Post(":webhookKey")
  @HttpCode(200)
  async receiveTenant(
    @Param("webhookKey", ParseUUIDPipe) webhookKey: string,
    @Req() request: Request & { rawBody?: Buffer },
    @Headers("x-hub-signature-256") signature?: string,
  ) {
    const result = await this.webhooks.receiveTenant(
      webhookKey,
      request.rawBody,
      signature,
    );
    if (result.eventId) {
      await this.queue.add(
        "process",
        { eventId: result.eventId },
        {
          jobId: result.eventId,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      );
    }
    return { received: true };
  }
}
