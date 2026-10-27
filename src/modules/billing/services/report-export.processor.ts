import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  REPORT_EXPORT_QUEUE,
  ReportExportService,
} from "./report-export.service";

@Processor(REPORT_EXPORT_QUEUE, { concurrency: 2 })
export class ReportExportProcessor extends WorkerHost {
  constructor(private readonly reports: ReportExportService) {
    super();
  }
  process(job: Job<{ organizationId: string; reportId: string }>) {
    if (job.name === "expire-trials") return this.reports.expireTrials();
    return this.reports.process(job.data.organizationId, job.data.reportId);
  }
}
