import { HttpException } from "@nestjs/common";
import { ErrorCodeValue } from "./error.code";

type MessageParams = Record<string, string | number>;

export class BusinessException extends HttpException {
  constructor(
    error: ErrorCodeValue,
    params?: MessageParams,
    data: unknown = null,
  ) {
    const message = BusinessException.formatMessage(error.message, params);

    super(
      {
        errorCode: error.code,
        message,
        data,
      },
      error.statusCode,
    );
  }

  private static formatMessage(
    message: string,
    params?: MessageParams,
  ): string {
    if (!params) {
      return message;
    }

    return Object.keys(params).reduce((finalMessage, key) => {
      return finalMessage.replaceAll(`{${key}}`, String(params[key]));
    }, message);
  }
}
