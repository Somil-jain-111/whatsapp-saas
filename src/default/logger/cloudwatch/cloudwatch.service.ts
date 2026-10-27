import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../../../default/config/config.service";
import { DataSanitizer } from "../../../default/common/utils/sanitize.utils";
import { Formatter } from "../../../default/common/utils/format.util";

@Injectable()
export class CloudwatchService implements OnModuleInit {
  private cloudWatchClient: CloudWatchLogsClient | null = null;
  private logGroupName: string;

  /**
   * Separate sequence token for each log stream.
   */
  private streamSequenceTokens = new Map<string, string | undefined>();

  private readonly logLevels = ["log", "error", "warn", "debug", "verbose"];

  constructor(private readonly appConfigService: AppConfigService) {
    const appName = this.appConfigService.get("APP_NAME") || "NestApp";
    const nodeEnv = this.appConfigService.get("NODE_ENV") || "development";

    this.logGroupName = `${appName}-${nodeEnv}`;

    // CloudWatch is opt-in outside development — every call site below already
    // guards on `this.cloudWatchClient` being set, so leaving it null here is
    // enough to make the whole pipeline (log group/stream creation, PutLogEvents)
    // a no-op in dev instead of spamming AWS auth errors on invalid/local creds.
    if (nodeEnv === "development") {
      return;
    }

    const awsRegion = this.appConfigService.get("AWS_REGION");
    const awsAccessKeyId = this.appConfigService.get("AWS_ACCESS_KEY_ID");
    const awsSecretAccessKey = this.appConfigService.get(
      "AWS_SECRET_ACCESS_KEY",
    );

    this.cloudWatchClient = new CloudWatchLogsClient({
      region: awsRegion,
      ...(awsAccessKeyId && awsSecretAccessKey
        ? {
            credentials: {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretAccessKey,
            },
          }
        : {}),
    });
  }

  async onModuleInit() {
    if (!this.cloudWatchClient) return;

    // Deliberately not awaited: these are 6+ sequential AWS calls, and onModuleInit
    // runs inside app.init() (triggered by app.listen()). Awaiting them means a slow
    // or unreachable CloudWatch endpoint blocks the HTTP server from ever binding —
    // the app then never logs "Nest application successfully started" and the port
    // stays closed. Log-infrastructure setup must never gate serving traffic; every
    // sendLog() call re-checks the stream via ensureLogStreamExists() anyway.
    void this.warmUpLogStreams().catch((error) => {
      console.error(
        "CloudWatch initialization failed (logging degraded):",
        error,
      );
    });
  }

  private async warmUpLogStreams() {
    await this.ensureLogGroupExists();

    for (const level of this.logLevels) {
      const streamName = this.getLogStreamName(level);
      await this.ensureLogStreamExists(streamName);
    }
  }

  async sendLog(payload: any) {
    if (!this.cloudWatchClient) return;

    const level = String(payload?.level || "log").toLowerCase();
    const logStreamName = this.getLogStreamName(level);

    try {
      await this.ensureLogStreamExists(logStreamName);

      const sanitized = DataSanitizer.sanitizeData(payload);

      if (sanitized.trace) {
        sanitized.trace = Formatter.formatStackTrace(sanitized.trace);
      }

      const sequenceToken = this.streamSequenceTokens.get(logStreamName);

      const res = await this.cloudWatchClient.send(
        new PutLogEventsCommand({
          logGroupName: this.logGroupName,
          logStreamName,
          logEvents: [
            {
              message: this.stringifyWithBigInt(sanitized),
              timestamp: Date.now(),
            },
          ],
          sequenceToken,
        }),
      );

      this.streamSequenceTokens.set(logStreamName, res.nextSequenceToken);
    } catch (err: any) {
      if (err.name === "InvalidSequenceTokenException") {
        await this.retryWithExpectedSequenceToken(err, logStreamName, payload);
        return;
      }

      if (err.name === "ResourceNotFoundException") {
        await this.ensureLogStreamExists(logStreamName);
        await this.sendLog(payload);
        return;
      }

      console.error("CloudWatch log error:", err);
    }
  }

  private getTodayDate(): string {
    return new Date().toISOString().split("T")[0];
  }

  private getLogStreamName(level: string): string {
    const normalizedLevel = level.toLowerCase();
    const date = this.getTodayDate();

    const instance = process.env.HOSTNAME || `pid-${process.pid}`;
    return `${this.logGroupName}-${normalizedLevel}-${date}-${instance}`;
  }

  private async ensureLogGroupExists() {
    if (!this.cloudWatchClient) return;

    const command = new DescribeLogGroupsCommand({
      logGroupNamePrefix: this.logGroupName,
    });

    const response = await this.cloudWatchClient.send(command);

    const exists = response.logGroups?.some(
      (group) => group.logGroupName === this.logGroupName,
    );

    if (!exists) {
      await this.cloudWatchClient.send(
        new CreateLogGroupCommand({
          logGroupName: this.logGroupName,
        }),
      );
    }
  }

  private async ensureLogStreamExists(logStreamName: string) {
    if (!this.cloudWatchClient) return;

    const command = new DescribeLogStreamsCommand({
      logGroupName: this.logGroupName,
      logStreamNamePrefix: logStreamName,
    });

    const response = await this.cloudWatchClient.send(command);

    const stream = response.logStreams?.find(
      (item) => item.logStreamName === logStreamName,
    );

    if (stream) {
      this.streamSequenceTokens.set(logStreamName, stream.uploadSequenceToken);
      return;
    }

    await this.cloudWatchClient.send(
      new CreateLogStreamCommand({
        logGroupName: this.logGroupName,
        logStreamName,
      }),
    );

    this.streamSequenceTokens.set(logStreamName, undefined);
  }

  private async retryWithExpectedSequenceToken(
    err: any,
    logStreamName: string,
    payload: any,
  ) {
    if (!this.cloudWatchClient) return;

    const expectedSequenceToken = err.expectedSequenceToken;

    this.streamSequenceTokens.set(logStreamName, expectedSequenceToken);

    const res = await this.cloudWatchClient.send(
      new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName,
        logEvents: [
          {
            message: this.stringifyWithBigInt(payload),
            timestamp: Date.now(),
          },
        ],
        sequenceToken: expectedSequenceToken,
      }),
    );

    this.streamSequenceTokens.set(logStreamName, res.nextSequenceToken);
  }

  private stringifyWithBigInt(data: any) {
    return JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
  }
}
