import { EmailTemplateType } from "../enums/email-template.enum";
import {
  MailPayload,
  OtpVerificationTemplateData,
  OtpRateLimitTemplateData,
} from "../dto/mailer.dto";
import { CommonUtils } from "../utils/common.utils";

export const DEFAULT_MAIL_FROM = "noreply@almonds.ai";
export const DEFAULT_RATE_LIMIT_RECIPIENTS = [
  "harmeet.singh@almonds.ai",
  "somil.jain@almonds.ai",
];

export const EMAIL_TEMPLATES: {
  [EmailTemplateType.OTP_VERIFICATION]: (
    data: OtpVerificationTemplateData,
  ) => MailPayload;
  [EmailTemplateType.OTP_RATE_LIMIT_TRIGGERED]: (
    data: OtpRateLimitTemplateData,
  ) => MailPayload;
} = {
  [EmailTemplateType.OTP_VERIFICATION]: (
    data: OtpVerificationTemplateData,
  ): MailPayload => {
    const recipientEmail = data.email.trim();
    const name = data.name && data.name.trim() ? data.name.trim() : "User";
    const otp = data.otp.trim();
    const subject = "Your OTP for Campus Shoes Loyalty Program";

    return {
      mailName: subject,
      mailSubject: subject,
      from: DEFAULT_MAIL_FROM,
      to: [recipientEmail],
      cc: [],
      htmlContent: `<p>Dear ${name},</p><p>Your OTP for verifying your email address is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes. Do not share it with anyone.</p><p>Regards,<br/>Campus Shoes Loyalty Program</p>`,
      attachments: [],
    };
  },

  [EmailTemplateType.OTP_RATE_LIMIT_TRIGGERED]: (
    data: OtpRateLimitTemplateData,
  ): MailPayload => {
    const user = data.user;
    const recipients =
      data.to && data.to.length > 0
        ? data.to.map((e) => e.trim()).filter((e) => e.length > 0)
        : DEFAULT_RATE_LIMIT_RECIPIENTS;

    const username =
      user.username && user.username.trim() ? user.username.trim() : "-";

    const timeframeHours = user.timeframeSeconds
      ? user.timeframeSeconds / 3600
      : 1;
    const hoursText =
      timeframeHours === 1 ? "1 hour" : `${timeframeHours} hours`;
    const attemptsText = user.attempts !== undefined ? user.attempts : 3;

    return {
      mailName: "OTP Rate Limit Triggered",
      mailSubject: `CAMPUS - Possible Malicious OTP Activity - ${user.mobile}`,
      from: DEFAULT_MAIL_FROM,
      to: recipients,
      cc: [],
      htmlContent: `
          <h3>Possible Malicious OTP Activity Detected</h3>
 
          <table border="1" cellpadding="8" cellspacing="0">
            <tr>
              <td><b>User ID</b></td>
              <td>${user.id}</td>
            </tr>
            <tr>
              <td><b>Name</b></td>
              <td>${username}</td>
            </tr>
            <tr>
              <td><b>Mobile</b></td>
              <td>${user.mobile}</td>
            </tr>
            <tr>
              <td><b>Time</b></td>
              <td>${CommonUtils.getLocalTimeString()}</td>
            </tr>
          </table>
 
          <br/>
 
          User has attempted to request OTP more than <b>${attemptsText} times within ${hoursText}.</b>
        `.trim(),
      attachments: [],
    };
  },
};
