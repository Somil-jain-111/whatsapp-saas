import { Injectable } from "@nestjs/common";
import { WhatsappIntegrationRepository } from "../repositories/whatsapp-integration.repository";

@Injectable()
export class IntegrationHealthService {
  constructor(private readonly repository: WhatsappIntegrationRepository) {}

  async health(organizationId: string) {
    const connections = await this.repository.listConnections(organizationId);
    const counts = connections.reduce<Record<string, number>>(
      (result, connection) => {
        result[connection.status] = (result[connection.status] ?? 0) + 1;
        return result;
      },
      {},
    );
    return {
      status:
        connections.length === 0
          ? "NOT_CONNECTED"
          : connections.some((connection) => connection.status === "CONNECTED")
            ? "HEALTHY"
            : "ACTION_REQUIRED",
      connectionCounts: counts,
      lastSuccessfulSync:
        connections
          .map((connection) => connection.lastSyncedAt)
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    };
  }

  errors(organizationId: string, limit: number) {
    return this.repository.listErrors(organizationId, limit);
  }
}
