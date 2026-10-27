import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { AutomationsService, WORKFLOW_QUEUE } from "./automations.service";
import { WorkflowEngineService } from "./workflow-engine.service";

@Processor(WORKFLOW_QUEUE, { concurrency: 10 })
export class WorkflowProcessor extends WorkerHost {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly service: AutomationsService,
  ) {
    super();
  }
  process(job: Job<{ organizationId: string; executionId: string }>) {
    return job.name === "recovery"
      ? this.service.recovery()
      : this.engine.execute(job.data.organizationId, job.data.executionId);
  }
}
