import axios from "axios";
import { ConsoleLogger } from "src/default/logger/console/console.service";
import { ERROR_CODES } from "src/default/error/error.code";
import { BusinessException } from "src/default/error/business.exception";
import { EmailTemplateType } from "../enums/email-template.enum";
import {
  EmailTemplateDataMap,
  MailPayload,
  OtpRateLimitTemplateData,
  OtpVerificationTemplateData,
} from "../dto/mailer.dto";
import { EMAIL_TEMPLATES } from "../constants/email-templates.constant";

export class MailerHelper {
  /**
   * Validate raw MailPayload to ensure no null or undefined or empty required fields pass through.
   */
  public static validatePayload(payload: MailPayload): void {
    if (!payload) {
      throw new BusinessException(ERROR_CODES.COMMON.BAD_REQUEST_RESON, {
        reason: "Email payload must be provided",
      });
    }

    if (!payload.mailName || !payload.mailName.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "mailName",
        },
      );
    }

    if (!payload.mailSubject || !payload.mailSubject.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "mailSubject",
        },
      );
    }

    if (!payload.from || !payload.from.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "from",
        },
      );
    }

    if (!Array.isArray(payload.to) || payload.to.length === 0) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "to (recipients)",
        },
      );
    }

    for (const recipient of payload.to) {
      if (!recipient || !recipient.trim()) {
        throw new BusinessException(ERROR_CODES.COMMON.BAD_REQUEST_RESON, {
          reason: "Recipient email address cannot be empty, null, or undefined",
        });
      }
    }

    if (!payload.htmlContent || !payload.htmlContent.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "htmlContent",
        },
      );
    }
  }

  /**
   * Validate required fields for template data based on template type.
   */
  public static validateTemplateData<T extends EmailTemplateType>(
    templateType: T,
    data: EmailTemplateDataMap[T],
  ): void {
    if (!templateType) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "templateType",
        },
      );
    }

    if (!data) {
      throw new BusinessException(ERROR_CODES.COMMON.BAD_REQUEST_RESON, {
        reason: "Template data must be provided",
      });
    }

    switch (templateType) {
      case EmailTemplateType.OTP_VERIFICATION:
        MailerHelper.validateOtpVerificationData(
          data as OtpVerificationTemplateData,
        );
        break;

      case EmailTemplateType.OTP_RATE_LIMIT_TRIGGERED:
        MailerHelper.validateOtpRateLimitData(data as OtpRateLimitTemplateData);
        break;

      default:
        throw new BusinessException(ERROR_CODES.COMMON.BAD_REQUEST_RESON, {
          reason: `Unsupported email template type: ${templateType}`,
        });
    }
  }

  private static validateOtpVerificationData(
    otpData: OtpVerificationTemplateData,
  ): void {
    if (!otpData.email || !otpData.email.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "email",
        },
      );
    }
    if (!otpData.otp || !otpData.otp.trim()) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "otp",
        },
      );
    }
  }

  private static validateOtpRateLimitData(
    rateLimitData: OtpRateLimitTemplateData,
  ): void {
    if (!rateLimitData.user) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "user",
        },
      );
    }

    if (
      rateLimitData.user.id === null ||
      rateLimitData.user.id === undefined ||
      String(rateLimitData.user.id).trim() === ""
    ) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "user.id",
        },
      );
    }
    if (
      !rateLimitData.user.mobile ||
      !String(rateLimitData.user.mobile).trim()
    ) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "user.mobile",
        },
      );
    }
    if (
      rateLimitData.user.attempts === null ||
      rateLimitData.user.attempts === undefined ||
      typeof rateLimitData.user.attempts !== "number"
    ) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "user.attempts",
        },
      );
    }
    if (
      rateLimitData.user.timeframeSeconds === null ||
      rateLimitData.user.timeframeSeconds === undefined ||
      typeof rateLimitData.user.timeframeSeconds !== "number"
    ) {
      throw new BusinessException(
        ERROR_CODES.VALIDATION.REQUIRED_FIELD_MISSING,
        {
          field: "user.timeframeSeconds",
        },
      );
    }
  }

  /**
   * Core method to send email payload to communication API.
   */
  public static async sendMail(payload: MailPayload): Promise<unknown> {
    MailerHelper.validatePayload(payload);

    try {
      ConsoleLogger.log(
        `Sending email | subject=${payload.mailSubject} | to=${payload.to.join(",")}`,
        "MailerHelper",
      );

      const communicationUrl = process.env.COMMUNICATION_API_URL;
      const communicationToken = process.env.COMMUNICATION_API_TOKEN;
      if (!communicationUrl || !communicationToken) {
        throw new Error("Communication API configuration is missing");
      }
      const response = await axios.post(communicationUrl, payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${communicationToken}`,
        },
        maxBodyLength: Infinity,
        timeout: 10_000,
      });

      ConsoleLogger.log(
        `Email sent successfully | status=${response?.status} | to=${payload.to.join(",")}`,
        "MailerHelper",
      );

      return response?.data;
    } catch (error: any) {
      ConsoleLogger.error(
        `Email dispatch failed | subject=${payload.mailSubject} | message=${error?.message}`,
        error?.stack,
        {
          tag: "MailerHelper.sendMail",
          data: {
            to: payload.to,
            subject: payload.mailSubject,
          },
        },
      );
      throw error;
    }
  }

  /**
   * Render template and send email with strict typing and validation.
   */
  public static async sendMailByTemplate<T extends EmailTemplateType>(
    templateType: T,
    data: EmailTemplateDataMap[T],
  ): Promise<unknown> {
    MailerHelper.validateTemplateData(templateType, data);

    const templateGenerator = EMAIL_TEMPLATES[templateType];

    if (!templateGenerator) {
      throw new BusinessException(ERROR_CODES.COMMON.BAD_REQUEST_RESON, {
        reason: `Template generator not found for template type: ${templateType}`,
      });
    }

    const payload = templateGenerator(data as any);
    return MailerHelper.sendMail(payload);
  }

  /**
   * Helper method to send OTP Verification Email.
   */
  public static async sendOtpVerificationEmail(
    data: OtpVerificationTemplateData,
  ): Promise<unknown> {
    return MailerHelper.sendMailByTemplate(
      EmailTemplateType.OTP_VERIFICATION,
      data,
    );
  }

  /**
   * Helper method to send OTP Rate Limit Alert Email.
   */
  public static async sendOtpRateLimitEmail(
    data: OtpRateLimitTemplateData,
  ): Promise<unknown> {
    return MailerHelper.sendMailByTemplate(
      EmailTemplateType.OTP_RATE_LIMIT_TRIGGERED,
      data,
    );
  }
}
