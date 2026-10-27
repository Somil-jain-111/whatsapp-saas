import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MetaWebhookService } from "./meta-webhook.service";

export const META_WEBHOOK_QUEUE = "meta-webhooks";

@Processor(META_WEBHOOK_QUEUE)
export class MetaWebhookProcessor extends WorkerHost {
  constructor(private readonly webhooks: MetaWebhookService) {
    super();
  }

  process(job: Job<{ eventId: string }>): Promise<void> {
    return this.webhooks.process(job.data.eventId);
  }
}
