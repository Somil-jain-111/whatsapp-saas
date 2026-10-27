import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { MessagingService, WHATSAPP_SEND_QUEUE } from "./messaging.service";
@Processor(WHATSAPP_SEND_QUEUE, {
  concurrency: 5,
  limiter: {
    max: Number(process.env.META_SEND_RATE_PER_SECOND ?? 20),
    duration: 1000,
  },
})
export class MessagingProcessor extends WorkerHost {
  constructor(private readonly service: MessagingService) {
    super();
  }
  process(
    job: Job<{
      organizationId: string;
      messageId?: string;
      campaignId?: string;
    }>,
  ) {
    return job.name === "outbox-scan"
      ? this.service.processOutbox()
      : job.name === "campaign"
        ? this.service.dispatchCampaign(
            job.data.organizationId,
            job.data.campaignId!,
          )
        : this.service.deliver(job.data.organizationId, job.data.messageId!);
  }
  @OnWorkerEvent("failed")
  onFailed(job: Job<{ organizationId: string; campaignId?: string }>) {
    if (
      job.name === "campaign" &&
      job.data.campaignId &&
      job.attemptsMade >= Number(job.opts.attempts ?? 1)
    )
      return this.service.failCampaign(
        job.data.organizationId,
        job.data.campaignId,
      );
  }
}
