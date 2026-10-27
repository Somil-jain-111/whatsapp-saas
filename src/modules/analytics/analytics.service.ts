import { Injectable } from "@nestjs/common";
import { BusinessException } from "../../default/error/business.exception";
import { ERROR_CODES } from "../../default/error/error.code";
import { AnalyticsRepository } from "./analytics.repository";
import { AnalyticsQueryDto, JourneyEventDto } from "./dto/analytics-query.dto";

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  recordJourney(
    organizationId: string,
    userId: string,
    sessionId: string,
    dto: JourneyEventDto,
  ) {
    return this.repo.recordJourney(organizationId, userId, sessionId, dto);
  }

  overview(organizationId: string, query: AnalyticsQueryDto) {
    return this.repo.overview(organizationId, query);
  }

  campaigns(organizationId: string, query: AnalyticsQueryDto) {
    return this.repo.campaigns(organizationId, query);
  }

  async campaign(organizationId: string, id: string) {
    const campaign = await this.repo.campaign(organizationId, id);
    if (!campaign)
      throw new BusinessException(ERROR_CODES.ANALYTICS.CAMPAIGN_NOT_FOUND);
    return campaign;
  }

  templates(organizationId: string, query: AnalyticsQueryDto) {
    return this.repo.templates(organizationId, query);
  }

  messages(organizationId: string, query: AnalyticsQueryDto) {
    return this.repo.messages(organizationId, query);
  }

  costs(organizationId: string, query: AnalyticsQueryDto) {
    return this.repo.costs(organizationId, query);
  }
}
