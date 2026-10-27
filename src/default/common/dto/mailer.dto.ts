import { EmailTemplateType } from "../enums/email-template.enum";

export interface MailAttachment {
  filename?: string;
  content?: string;
  path?: string;
  contentType?: string;
}

export interface MailPayload {
  mailName: string;
  mailSubject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  htmlContent: string;
  attachments?: MailAttachment[];
}

export interface OtpVerificationTemplateData {
  email: string;
  otp: string;
  name?: string;
}

export interface OtpRateLimitUserData {
  id: number | string;
  username?: string | null;
  mobile: string;
  attempts?: number;
  timeframeSeconds: number;
}

export interface OtpRateLimitTemplateData {
  user: OtpRateLimitUserData;
  to?: string[];
}

export interface EmailTemplateDataMap {
  [EmailTemplateType.OTP_VERIFICATION]: OtpVerificationTemplateData;
  [EmailTemplateType.OTP_RATE_LIMIT_TRIGGERED]: OtpRateLimitTemplateData;
}
