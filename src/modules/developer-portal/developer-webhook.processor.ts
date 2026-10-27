import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  DEVELOPER_WEBHOOK_QUEUE,
  DeveloperWebhookService,
} from "./developer-webhook.service";

@Processor(DEVELOPER_WEBHOOK_QUEUE)
export class DeveloperWebhookProcessor extends WorkerHost {
  constructor(private readonly webhooks: DeveloperWebhookService) {
    super();
  }

  process(job: Job<{ id?: string; organizationId?: string }>) {
    if (job.name === "retention-cleanup") return this.webhooks.cleanup();
    return this.webhooks.deliver(job.data.organizationId!, job.data.id!);
  }
}
