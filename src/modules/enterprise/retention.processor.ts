import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { EnterpriseRepository } from "./enterprise.repository";

export const RETENTION_QUEUE = "enterprise-retention";

@Injectable()
@Processor(RETENTION_QUEUE)
export class RetentionProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly repo: EnterpriseRepository,
    @InjectQueue(RETENTION_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    await this.queue.add(
      "scan",
      {},
      {
        jobId: "enterprise-retention-scan",
        repeat: { every: 60 * 60 * 1000 },
        removeOnComplete: 10,
        removeOnFail: 100,
      },
    );
  }

  async process(job: Job) {
    if (job.name === "scan") {
      const rows = await this.repo.scanRetentionJobs();
      for (const row of rows)
        await this.queue.add(
          "delete-batch",
          { id: row.id },
          {
            jobId: `retention-${row.id}`,
            attempts: 5,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: true,
          },
        );
      return { scheduled: rows.length };
    }
    if (job.name !== "delete-batch")
      throw new Error(`Unknown retention job: ${job.name}`);
    const record = await this.repo.retentionJob(String(job.data.id));
    if (!record || record.status === "COMPLETED" || record.legal_hold) return;
    if (!(await this.repo.claimRetentionJob(record.organization_id, record.id)))
      return;
    try {
      const count = await this.repo.processRetentionBatch(record);
      if (count === 500)
        await this.queue.add(
          "delete-batch",
          { id: record.id },
          {
            delay: 100,
            attempts: 5,
            backoff: { type: "exponential", delay: 5000 },
          },
        );
      return { processed: count };
    } catch (error: any) {
      await this.repo.failRetentionJob(
        record.organization_id,
        record.id,
        String(error?.code ?? "RETENTION_BATCH_FAILED"),
      );
      throw error;
    }
  }
}
