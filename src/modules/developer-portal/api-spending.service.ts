import { Injectable } from "@nestjs/common";
import { AuditRepository } from "../audit/audit.repository";
import { DeveloperPortalRepository } from "./developer-portal.repository";

@Injectable()
export class ApiSpendingService {
  constructor(
    private readonly repo: DeveloperPortalRepository,
    private readonly audit: AuditRepository,
  ) {}

  get(org: string) {
    return this.repo.getSpendingCap(org);
  }

  async update(org: string, user: string, amountMinor: number | null) {
    const result = await this.repo.updateSpendingCap(org, amountMinor);
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.spending_cap.updated",
      resourceType: "organization",
      resourceId: org,
      metadata: { amountMinor },
    });
    return result;
  }
}
