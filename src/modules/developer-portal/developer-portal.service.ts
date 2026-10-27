import { Injectable } from "@nestjs/common";
import { ListApiLogsDto } from "./dto/developer-portal.dto";
import { DeveloperPortalRepository } from "./developer-portal.repository";

@Injectable()
export class DeveloperPortalService {
  constructor(private readonly repo: DeveloperPortalRepository) {}

  overview(organizationId: string) {
    return this.repo.overview(organizationId);
  }

  requestLogs(organizationId: string, query: ListApiLogsDto) {
    return this.repo.listLogs(organizationId, query);
  }
}
