import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CONTACT_IMPORT_QUEUE } from "../contacts/contact-import.service";
import { WHATSAPP_SEND_QUEUE } from "../messaging/messaging.service";
import { META_WEBHOOK_QUEUE } from "../whatsapp-integration/services/meta-webhook.processor";
import { REPORT_EXPORT_QUEUE } from "../billing/services/report-export.service";
import { WORKFLOW_QUEUE } from "../automations/automations.service";
import { DEVELOPER_WEBHOOK_QUEUE } from "../developer-portal/developer-webhook.service";
import {
  CreateAdminPlanDto,
  CreateBillingAdjustmentDto,
  UpdateAdminPlanDto,
  AdminCustomerListDto,
} from "./dto/platform-admin.dto";
import { PlatformAdminRepository } from "./platform-admin.repository";

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly repo: PlatformAdminRepository,
    @InjectQueue(CONTACT_IMPORT_QUEUE) private readonly contactImports: Queue,
    @InjectQueue(WHATSAPP_SEND_QUEUE) private readonly messages: Queue,
    @InjectQueue(META_WEBHOOK_QUEUE) private readonly webhooks: Queue,
    @InjectQueue(REPORT_EXPORT_QUEUE) private readonly reportsQueue: Queue,
    @InjectQueue(WORKFLOW_QUEUE) private readonly workflows: Queue,
    @InjectQueue(DEVELOPER_WEBHOOK_QUEUE)
    private readonly developerWebhooks: Queue,
  ) {}
  billingOverview() {
    return this.repo.billingOverview();
  }
  overview() {
    return this.repo.platformOverview();
  }
  customers(dto: AdminCustomerListDto) {
    return this.repo.customers(dto);
  }
  async customer(id: string) {
    const value = await this.repo.customer(id);
    if (!value) throw new NotFoundException("Customer not found");
    return value;
  }
  async customerAudit(id: string, dto: AdminCustomerListDto) {
    await this.customer(id);
    return this.repo.customerAudit(id, dto);
  }
  async customerJourney(id: string, dto: AdminCustomerListDto) {
    await this.customer(id);
    return this.repo.customerJourney(id, dto);
  }
  subscriptions() {
    return this.repo.adminList("subscriptions");
  }
  payments() {
    return this.repo.adminList("payments");
  }
  invoices() {
    return this.repo.adminList("invoices");
  }
  revenue() {
    return this.repo.revenue();
  }
  usage() {
    return this.repo.globalUsage();
  }
  analytics() {
    return this.repo.platformAnalytics();
  }
  apiOverview() {
    return this.repo.apiOverview();
  }
  apiKeys() {
    return this.repo.apiKeys();
  }
  apiSecurityEvents() {
    return this.repo.apiSecurityEvents();
  }
  async setTenantApiStatus(
    org: string,
    enabled: boolean,
    admin: { id: string; role: string },
  ) {
    this.assertSuperAdmin(admin);
    const result = await this.repo.setTenantApiStatus(org, enabled, admin.id);
    if (!result) throw new NotFoundException("Customer not found");
    return result;
  }
  async emergencyRevokeKey(id: string, admin: { id: string; role: string }) {
    this.assertSuperAdmin(admin);
    const result = await this.repo.emergencyRevokeKey(id, admin.id);
    if (!result) throw new NotFoundException("Active API key not found");
    return result;
  }
  metaConnections() {
    return this.repo.metaConnections();
  }
  metaHealth() {
    return this.repo.metaHealth();
  }
  metaErrors() {
    return this.repo.metaErrors();
  }
  templates() {
    return this.repo.templates();
  }
  templateMetrics() {
    return this.repo.templateMetrics();
  }
  reportJobs() {
    return this.repo.reportJobs();
  }
  inboxHealth() {
    return this.repo.inboxHealth();
  }
  async queueHealth() {
    return Promise.all(
      [
        this.contactImports,
        this.messages,
        this.webhooks,
        this.reportsQueue,
        this.workflows,
        this.developerWebhooks,
      ].map(async (queue) => ({
        name: queue.name,
        counts: await queue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed",
          "completed",
        ),
      })),
    );
  }
  createPlan(dto: CreateAdminPlanDto) {
    return this.repo.createPlan(dto);
  }
  async updatePlan(id: string, dto: UpdateAdminPlanDto) {
    const value = await this.repo.updatePlan(id, dto);
    if (!value) throw new NotFoundException("Plan not found");
    return value;
  }
  adjustment(adminId: string, dto: CreateBillingAdjustmentDto) {
    return this.repo.adjustment(adminId, dto);
  }
  private assertSuperAdmin(admin: { role: string }) {
    if (admin.role !== "SUPER_ADMIN")
      throw new ForbiddenException("Super administrator permission required");
  }
}
