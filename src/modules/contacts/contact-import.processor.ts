import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  CONTACT_IMPORT_QUEUE,
  ContactImportService,
} from "./contact-import.service";

@Processor(CONTACT_IMPORT_QUEUE, { concurrency: 2 })
export class ContactImportProcessor extends WorkerHost {
  constructor(private readonly imports: ContactImportService) {
    super();
  }
  process(job: Job<{ organizationId: string; importId: string }>) {
    return this.imports.process(job.data.organizationId, job.data.importId);
  }
}
