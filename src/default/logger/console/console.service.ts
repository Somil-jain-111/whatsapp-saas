import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EventsType } from "../../common/constants/events.option";
import { DataSanitizer } from "../../common/utils/sanitize.utils";
import { LocalStorageContextUtil } from "src/default/common/utils/local-storage.util";
import { ContextType } from "src/default/common/constants/context.option";

interface LogContext {
  tag?: string;
  data?: any;
}

export class ConsoleLogger extends Logger {
  private static instance: ConsoleLogger;
  private readonly isConsoleEnabled: boolean;
  private readonly eventEmitter: EventEmitter2;

  private constructor(eventEmitter: EventEmitter2) {
    super();
    this.eventEmitter = eventEmitter;
    this.isConsoleEnabled = process.env.ENABLE_CONSOLE_LOG === "true";
  }

  static initialize(eventEmitter: EventEmitter2): void {
    if (!ConsoleLogger.instance) {
      ConsoleLogger.instance = new ConsoleLogger(eventEmitter);
    }
  }

  static getInstance(): ConsoleLogger {
    if (!ConsoleLogger.instance) {
      throw new Error("ConsoleLogger has not been initialized");
    }

    return ConsoleLogger.instance;
  }

  static log(message: any, context?: string | LogContext): void {
    if (!this.instance) return Logger.log(message, this.contextName(context));
    this.instance.writeLog("log", message, context);
  }

  static error(
    message: any,
    trace?: string,
    context?: string | LogContext,
  ): void {
    if (!this.instance)
      return Logger.error(message, trace, this.contextName(context));
    this.instance.writeLog("error", message, context, trace);
  }

  static warn(message: any, context?: string | LogContext): void {
    if (!this.instance) return Logger.warn(message, this.contextName(context));
    this.instance.writeLog("warn", message, context);
  }

  static debug(message: any, context?: string | LogContext): void {
    if (!this.instance) return Logger.debug(message, this.contextName(context));
    this.instance.writeLog("debug", message, context);
  }

  static verbose(message: any, context?: string | LogContext): void {
    if (!this.instance)
      return Logger.verbose(message, this.contextName(context));
    this.instance.writeLog("verbose", message, context);
  }

  private static contextName(context?: string | LogContext) {
    return typeof context === "string"
      ? context
      : (context?.tag ?? "Bootstrap");
  }

  private writeLog(
    level: string,
    message: any,
    context?: string | LogContext,
    trace?: string,
  ): void {
    let tag = "General";
    let extraData = null;

    if (typeof context === "string") {
      tag = context;
    } else if (typeof context === "object" && context !== null) {
      tag = context.tag ?? "General";
      extraData = context.data ?? null;
    }

    const journeyId =
      LocalStorageContextUtil.get(ContextType.JOURNEY_ID) || null;

    const currentUser =
      LocalStorageContextUtil.get(ContextType.CURRENT_USER) || null;

    const rawSanitized = DataSanitizer.sanitizeData(message);

    const safeStringify = (data: any) => {
      try {
        return JSON.stringify(data, (_key, value) =>
          typeof value === "bigint"
            ? value.toString()
            : value instanceof Date
              ? value.toISOString()
              : value,
        );
      } catch {
        return String(data);
      }
    };

    let sanitizedMessage = safeStringify(rawSanitized);

    if (sanitizedMessage.length > 2000) {
      sanitizedMessage = sanitizedMessage.substring(0, 2000) + "... (trimmed)";
    }

    const trimmedEmit = sanitizedMessage.substring(0, 2000);

    this.eventEmitter.emit(EventsType.REMOTE_LOG, {
      level: level.toLowerCase(),
      response: trimmedEmit,
      context: tag,
      trace,
      data: DataSanitizer.sanitizeData(extraData, [
        "authorization",
        "cookie",
        "set-cookie",
        "apiKey",
        "apiSecret",
        "x-api-key",
        "x-api-secret",
        "x-hmac",
        "permanent_token",
        "token",
        "secret",
      ]),
      journeyId,
      sub: currentUser,
      timestamp: new Date().toISOString(),
    });

    if (this.isConsoleEnabled) {
      super.log(`[${level.toUpperCase()}] ${tag} ${sanitizedMessage}`);
    }
  }
}
