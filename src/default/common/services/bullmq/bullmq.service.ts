import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { BULLMQ_JOB, BULLMQ_QUEUE } from "./bullmq.constants";

@Injectable()
export class BullmqService {
  constructor(
    @InjectQueue(BULLMQ_QUEUE.CLOUDWATCH_LOG)
    private readonly cloudwatchLogQueue: Queue,
  ) {}

  async addCloudwatchLogJob(data: any) {
    return this.cloudwatchLogQueue.add(BULLMQ_JOB.SEND_CLOUDWATCH_LOG, data, {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: 100,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    });
  }
}
