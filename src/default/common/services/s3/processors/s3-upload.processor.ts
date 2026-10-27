import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { S3_JOB, S3_QUEUE } from "../constants/s3-queue.constant";
import { ProcessChunkUploadJob } from "../interfaces/s3-upload.interface";
import { S3Service } from "../s3.service";

@Processor(S3_QUEUE.UPLOAD)
export class S3UploadProcessor extends WorkerHost {
  constructor(private readonly s3Service: S3Service) {
    super();
  }

  async process(job: Job<ProcessChunkUploadJob>) {
    if (job.name === S3_JOB.PROCESS_CHUNK_UPLOAD) {
      return this.s3Service.processChunkUpload(job.data);
    }

    throw new Error(`Unknown S3 upload job: ${job.name}`);
  }
}
