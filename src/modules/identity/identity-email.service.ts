import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { MailerHelper } from "../../default/common/helper/mailer.helper";
import { AppConfigService } from "../../default/config/config.service";

export const IDENTITY_EMAIL_QUEUE = "identity-email";

interface IdentityEmailJob {
  email: string;
  fullName: string;
  token: string;
}

@Injectable()
export class IdentityEmailService {
  constructor(
    @InjectQueue(IDENTITY_EMAIL_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>("COMMUNICATION_API_URL") &&
      this.config.get<string>("COMMUNICATION_API_TOKEN") &&
      this.config.get<string>("APP_WEB_URL") &&
      this.config.get<string>("MAIL_FROM"),
    );
  }

  async queueVerification(data: IdentityEmailJob): Promise<void> {
    if (!this.isConfigured()) return;
    await this.queue.add("verify-email", data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  async queuePasswordReset(data: IdentityEmailJob): Promise<void> {
    if (!this.isConfigured()) return;
    await this.queue.add("reset-password", data, {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}

@Processor(IDENTITY_EMAIL_QUEUE, { concurrency: 2 })
export class IdentityEmailProcessor extends WorkerHost {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  process(job: Job<IdentityEmailJob>) {
    if (!["verify-email", "reset-password"].includes(job.name))
      throw new Error("Unsupported identity email job");
    const resetting = job.name === "reset-password";
    const link = new URL(
      resetting ? "/reset-password" : "/verify-email",
      this.config.get<string>("APP_WEB_URL"),
    );
    link.searchParams.set("token", job.data.token);
    const name = escapeHtml(job.data.fullName);
    return MailerHelper.sendMail({
      mailName: resetting
        ? "Reset your Relay password"
        : "Verify your Relay account",
      mailSubject: resetting
        ? "Reset your Relay password"
        : "Verify your Relay account",
      from: this.config.get<string>("MAIL_FROM"),
      to: [job.data.email],
      htmlContent: resetting
        ? `<p>Hello ${name},</p><p>Use the secure link below to set a new Relay password.</p><p><a href="${escapeHtml(link.toString())}">Reset password</a></p><p>This link expires in one hour. If you did not request it, ignore this email.</p>`
        : `<p>Hello ${name},</p><p>Verify your email address to activate your Relay workspace.</p><p><a href="${escapeHtml(link.toString())}">Verify email</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>`,
    });
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ]!,
  );
}
