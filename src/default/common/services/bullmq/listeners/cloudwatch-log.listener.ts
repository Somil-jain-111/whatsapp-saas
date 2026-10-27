import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EventsType } from "../../../constants/events.option";
import { BullmqService } from "../bullmq.service";

@Injectable()
export class CloudwatchLogListener {
  private static failureCount = 0;
  private static lastReportedAt = 0;

  constructor(private readonly bullmqService: BullmqService) {}

  @OnEvent(EventsType.REMOTE_LOG)
  async handleRemoteLogEvent(payload: any) {
    // Remote logging is best-effort. Every application log emits REMOTE_LOG, so an
    // unhealthy queue would otherwise turn each log line into an unhandled rejection
    // plus a multi-KB stack dump on stderr — which, with Docker's uncapped json-file
    // driver, fills the host disk. Swallow the failure and report at most once a
    // minute, using raw console.error so this can never re-enter ConsoleLogger.
    try {
      await this.bullmqService.addCloudwatchLogJob(payload);
    } catch (error) {
      CloudwatchLogListener.failureCount++;

      const now = Date.now();
      if (now - CloudwatchLogListener.lastReportedAt > 60_000) {
        CloudwatchLogListener.lastReportedAt = now;
        console.error(
          `Remote log queue unavailable (${CloudwatchLogListener.failureCount} dropped so far):`,
          (error as Error)?.message,
        );
        CloudwatchLogListener.failureCount = 0;
      }
    }
  }
}
