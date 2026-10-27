import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { BULLMQ_JOB, BULLMQ_QUEUE } from "../bullmq.constants";
import { CloudwatchService } from "../../../../logger/cloudwatch/cloudwatch.service";

@Processor(BULLMQ_QUEUE.CLOUDWATCH_LOG)
export class CloudwatchLogProcessor extends WorkerHost {
  constructor(private readonly cloudwatchService: CloudwatchService) {
    super();
  }

  async process(job: Job<any>) {
    if (job.name === BULLMQ_JOB.SEND_CLOUDWATCH_LOG) {
      await this.cloudwatchService.sendLog(job.data);
      return;
    }

    throw new Error(`Unknown BullMQ job: ${job.name}`);
  }
}
