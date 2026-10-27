import { Injectable } from "@nestjs/common";
import { ERROR_CODES } from "./error.code";
import { ConsoleLogger } from "../logger/console/console.service";

@Injectable()
export class ErrorHandlingService {
  handleError(error: any, request: any): any {
    const defaultError = ERROR_CODES.COMMON.SOMETHING_WENT_WRONG;
    const response = error?.response;

    const customMessage =
      response?.message ?? error?.message ?? defaultError.message;

    const customCode = error?.status ?? defaultError.statusCode;

    const errorCode =
      response?.errorCode ?? error?.driverError?.code ?? defaultError.code;

    const journeyId = request?.journeyId || "N/A";

    // Get error location from stack trace
    let errorLocation = "Unknown";
    if (error?.stack) {
      const stackLines = error.stack.split("\n");

      const appLine = stackLines.find(
        (line: string) =>
          line.includes("/src/") && !line.includes("error-handling.service"),
      );

      if (appLine) {
        errorLocation = appLine.trim();
      }
    }

    ConsoleLogger.error(
      `Handled Error - Code: ${customCode}, ErrorCode: ${errorCode}, Message: ${customMessage}, Location: ${errorLocation}, JourneyId: ${journeyId}`,
      error?.stack || JSON.stringify(error),
      "ErrorHandlingService",
    );

    return {
      status: false,
      code: customCode,
      errorCode,
      message: Array.isArray(customMessage)
        ? customMessage.join(", ")
        : customMessage,
      data: response?.data ?? null,
    };
  }
}
