import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditRepository } from "../../audit/audit.repository";
import { WhatsappIntegrationRepository } from "../repositories/whatsapp-integration.repository";

@Injectable()
export class AccountService {
  constructor(
    private readonly repository: WhatsappIntegrationRepository,
    private readonly audit: AuditRepository,
  ) {}

  list(organizationId: string) {
    return this.repository.listAccounts(organizationId);
  }

  async get(organizationId: string, id: string) {
    const account = await this.repository.getAccount(organizationId, id);
    if (!account) throw new NotFoundException("WhatsApp account not found");
    return account;
  }

  async phones(organizationId: string, accountId: string) {
    await this.get(organizationId, accountId);
    return this.repository.listPhoneNumbers(organizationId, accountId);
  }

  async setDefaultPhone(organizationId: string, userId: string, id: string) {
    if (!(await this.repository.setDefaultPhone(organizationId, id))) {
      throw new NotFoundException("Phone number not found");
    }
    await this.audit.append(organizationId, {
      actorUserId: userId,
      action: "whatsapp.phone.default_changed",
      resourceType: "whatsapp_phone_number",
      resourceId: id,
      metadata: {},
    });
  }
}
