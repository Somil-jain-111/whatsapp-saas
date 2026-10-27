import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CampaignsRepository } from "./campaigns.repository";
import { CampaignListDto, CreateCampaignDto } from "./dto/campaign.dto";
import { MessagingService } from "../messaging/messaging.service";
import { EntitlementService } from "../billing/services/entitlement.service";

export const CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  validate: ["DRAFT"],
  launch: ["DRAFT", "SCHEDULED", "PAUSED"],
  pause: ["SCHEDULED", "QUEUED", "RUNNING"],
  resume: ["PAUSED"],
  cancel: [
    "DRAFT",
    "VALIDATING",
    "SCHEDULED",
    "QUEUED",
    "RUNNING",
    "PAUSING",
    "PAUSED",
  ],
};
@Injectable()
export class CampaignsService {
  constructor(
    private readonly repo: CampaignsRepository,
    private readonly messaging: MessagingService,
    private readonly entitlements: EntitlementService,
  ) {}
  create(org: string, user: string, dto: CreateCampaignDto) {
    return this.repo.create(org, user, dto);
  }
  async createAndLaunch(org: string, user: string, dto: CreateCampaignDto) {
    const campaign = await this.create(org, user, dto);
    return this.transition(org, campaign.id, "launch");
  }
  list(org: string, dto: CampaignListDto) {
    return this.repo.list(org, dto);
  }
  async get(org: string, id: string) {
    const x = await this.repo.get(org, id);
    if (!x) throw new NotFoundException("Campaign not found");
    return x;
  }
  async validate(org: string, id: string) {
    const result = await this.repo.validate(org, id);
    if (!result) throw new NotFoundException("Campaign not found");
    return result;
  }
  async transition(
    org: string,
    id: string,
    action: keyof typeof CAMPAIGN_TRANSITIONS,
  ) {
    if (action === "launch") {
      const validation = await this.validate(org, id);
      if (!validation.valid)
        throw new ConflictException({
          message: "Campaign validation failed",
          errors: validation.errors,
        });
    }
    const campaign = action === "launch" ? await this.get(org, id) : null;
    const scheduledAt = campaign?.scheduled_at
      ? new Date(campaign.scheduled_at)
      : undefined;
    const scheduled = Boolean(
      scheduledAt && scheduledAt.getTime() > Date.now(),
    );
    const target = {
      launch: scheduled ? "SCHEDULED" : "QUEUED",
      pause: "PAUSED",
      resume: "QUEUED",
      cancel: "CANCELLED",
      validate: "VALIDATING",
    }[action];
    const reservation =
      action === "launch"
        ? await this.entitlements.reserveQuota(
            org,
            "monthly_campaigns",
            1,
            `campaign:${id}`,
          )
        : null;
    const value = await this.repo.transition(
      org,
      id,
      CAMPAIGN_TRANSITIONS[action],
      target,
    );
    if (!value) {
      if (reservation)
        await this.entitlements.releaseQuota(org, reservation.id);
      throw new ConflictException("Invalid campaign state transition");
    }
    if (action === "launch") {
      try {
        await this.repo.schedule(org, id, scheduledAt ?? new Date());
        await this.messaging.enqueueCampaign(
          org,
          id,
          scheduled ? scheduledAt : undefined,
        );
        await this.entitlements.commitQuota(org, reservation!.id);
      } catch (error) {
        await this.messaging.removeCampaignJob(id).catch(() => undefined);
        await this.repo.cancelSchedule(org, id).catch(() => undefined);
        await this.repo
          .transition(org, id, [target], campaign!.status)
          .catch(() => undefined);
        await this.entitlements.releaseQuota(org, reservation!.id);
        throw error;
      }
    } else if (action === "pause" || action === "cancel") {
      await this.messaging.removeCampaignJob(id);
      if (action === "cancel") await this.repo.cancelSchedule(org, id);
    } else if (action === "resume") {
      await this.messaging.resumeCampaign(org, id);
    }
    return value;
  }
  recipients(org: string, id: string) {
    return this.repo.recipients(org, id);
  }
  metrics(org: string, id: string) {
    return this.repo.metrics(org, id);
  }
}
