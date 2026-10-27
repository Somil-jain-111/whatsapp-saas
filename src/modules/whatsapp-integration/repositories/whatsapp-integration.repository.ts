import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import {
  IntegrationErrorEntity,
  IntegrationSyncJobEntity,
  MessageTemplateEntity,
  MetaConnectionEntity,
  MetaOnboardingSessionEntity,
  MetaWebhookEventEntity,
  TemplateComponentEntity,
  TemplateVersionEntity,
  WhatsappAccountEntity,
  WhatsappPhoneNumberEntity,
} from "../../database/entities";
import { TenantContextService } from "../../database/tenant-context.service";

export interface DraftInput {
  accountId: string;
  name: string;
  language: string;
  category: string;
  components: Array<{ type: string; payload: Record<string, unknown> }>;
}

export interface MetaAppConfigurationRow {
  id: string;
  organization_id: string;
  app_id: string;
  configuration_id: string;
  graph_api_version: string;
  webhook_key: string;
  secret_ciphertext?: Buffer;
  secret_nonce?: Buffer;
  secret_auth_tag?: Buffer;
  key_version?: string;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class WhatsappIntegrationRepository {
  constructor(private readonly tenants: TenantContextService) {}

  run<T>(
    organizationId: string,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.tenants.run(organizationId, work);
  }

  appConfiguration(
    organizationId: string,
    includeSecret = false,
  ): Promise<MetaAppConfigurationRow | null> {
    return this.run(organizationId, async (manager) => {
      const [row] = await manager.query(
        `SELECT id,organization_id,app_id,configuration_id,graph_api_version,webhook_key,created_at,updated_at
          ${includeSecret ? ",secret_ciphertext,secret_nonce,secret_auth_tag,key_version" : ""}
         FROM whatsapp_core.meta_app_configurations WHERE organization_id=$1`,
        [organizationId],
      );
      return row ?? null;
    });
  }

  appConfigurationByWebhookKey(
    webhookKey: string,
  ): Promise<MetaAppConfigurationRow | null> {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const [row] = await manager.query(
        `SELECT id,organization_id,app_id,configuration_id,graph_api_version,webhook_key,
                secret_ciphertext,secret_nonce,secret_auth_tag,key_version,created_at,updated_at
         FROM whatsapp_core.meta_app_configurations WHERE webhook_key=$1`,
        [webhookKey],
      );
      return row ?? null;
    });
  }

  saveAppConfiguration(
    organizationId: string,
    userId: string,
    input: {
      appId: string;
      configurationId: string;
      graphApiVersion: string;
      encrypted: {
        ciphertext: Buffer;
        nonce: Buffer;
        authTag: Buffer;
        keyVersion: string;
      };
    },
  ): Promise<MetaAppConfigurationRow> {
    return this.run(organizationId, async (manager) => {
      const [row] = await manager.query(
        `INSERT INTO whatsapp_core.meta_app_configurations(
           organization_id,app_id,configuration_id,graph_api_version,
           secret_ciphertext,secret_nonce,secret_auth_tag,key_version,
           created_by_user_id,updated_by_user_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         ON CONFLICT(organization_id) DO UPDATE SET
           app_id=excluded.app_id,configuration_id=excluded.configuration_id,
           graph_api_version=excluded.graph_api_version,
           secret_ciphertext=excluded.secret_ciphertext,secret_nonce=excluded.secret_nonce,
           secret_auth_tag=excluded.secret_auth_tag,key_version=excluded.key_version,
           updated_by_user_id=excluded.updated_by_user_id,updated_at=now()
         RETURNING id,organization_id,app_id,configuration_id,graph_api_version,webhook_key,created_at,updated_at`,
        [
          organizationId,
          input.appId,
          input.configurationId,
          input.graphApiVersion,
          input.encrypted.ciphertext,
          input.encrypted.nonce,
          input.encrypted.authTag,
          input.encrypted.keyVersion,
          userId,
        ],
      );
      return row;
    });
  }

  createOnboardingSession(
    organizationId: string,
    userId: string,
    stateHash: string,
    expiresAt: Date,
  ): Promise<MetaOnboardingSessionEntity> {
    return this.run(organizationId, (manager) =>
      manager.save(
        MetaOnboardingSessionEntity,
        manager.create(MetaOnboardingSessionEntity, {
          organizationId,
          createdByUserId: userId,
          stateHash,
          expiresAt,
        }),
      ),
    );
  }

  consumeOnboardingSession(
    organizationId: string,
    userId: string,
    stateHash: string,
  ): Promise<boolean> {
    return this.run(organizationId, async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(MetaOnboardingSessionEntity)
        .set({ consumedAt: () => "CURRENT_TIMESTAMP" })
        .where("organization_id = :organizationId", { organizationId })
        .andWhere("created_by_user_id = :userId", { userId })
        .andWhere("state_hash = :stateHash", { stateHash })
        .andWhere("consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP")
        .execute();
      return result.affected === 1;
    });
  }

  saveConnectedAssets(
    organizationId: string,
    encrypted: {
      ciphertext: Buffer;
      nonce: Buffer;
      authTag: Buffer;
      keyVersion: string;
    },
    tokenExpiresAt: Date | null,
    account: {
      id: string;
      name?: string;
      status?: string;
      verificationStatus?: string;
    },
    phones: Array<{
      id: string;
      displayPhoneNumber: string;
      phoneE164: string | null;
      verifiedName?: string;
      qualityRating?: string;
      messagingLimit?: string;
      status?: string;
    }>,
  ): Promise<MetaConnectionEntity> {
    return this.run(organizationId, async (manager) => {
      const connection = await manager.save(
        MetaConnectionEntity,
        manager.create(MetaConnectionEntity, {
          organizationId,
          status: "CONNECTED",
          credentialCiphertext: encrypted.ciphertext,
          credentialNonce: encrypted.nonce,
          credentialAuthTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          credentialCreatedAt: new Date(),
          tokenExpiresAt,
          lastSyncedAt: new Date(),
        }),
      );
      const savedAccount = await manager.save(
        WhatsappAccountEntity,
        manager.create(WhatsappAccountEntity, {
          organizationId,
          connectionId: connection.id,
          providerAccountId: account.id,
          businessName: account.name ?? null,
          status: account.status ?? "UNKNOWN",
          verificationStatus: account.verificationStatus ?? null,
          lastSyncedAt: new Date(),
        }),
      );
      if (phones.length) {
        await manager.save(
          WhatsappPhoneNumberEntity,
          phones.map((phone, index) =>
            manager.create(WhatsappPhoneNumberEntity, {
              organizationId,
              accountId: savedAccount.id,
              providerPhoneNumberId: phone.id,
              displayPhoneNumber: phone.displayPhoneNumber,
              phoneE164: phone.phoneE164,
              verifiedDisplayName: phone.verifiedName ?? null,
              qualityRating: phone.qualityRating ?? null,
              messagingLimit: phone.messagingLimit ?? null,
              status: phone.status ?? "UNKNOWN",
              isDefault: index === 0,
              lastSyncedAt: new Date(),
            }),
          ),
        );
      }
      return connection;
    });
  }

  listConnections(organizationId: string): Promise<MetaConnectionEntity[]> {
    return this.run(organizationId, (manager) =>
      manager.find(MetaConnectionEntity, {
        where: { organizationId },
        order: { createdAt: "DESC" },
      }),
    );
  }

  getConnection(
    organizationId: string,
    id: string,
    includeCredential = false,
  ): Promise<MetaConnectionEntity | null> {
    return this.run(organizationId, (manager) => {
      const query = manager
        .createQueryBuilder(MetaConnectionEntity, "connection")
        .where(
          "connection.id = :id AND connection.organization_id = :organizationId",
          {
            id,
            organizationId,
          },
        );
      if (includeCredential) {
        query.addSelect([
          "connection.credentialCiphertext",
          "connection.credentialNonce",
          "connection.credentialAuthTag",
        ]);
      }
      return query.getOne();
    });
  }

  async disconnect(
    organizationId: string,
    id: string,
    reason: string,
  ): Promise<boolean> {
    return this.run(organizationId, async (manager) => {
      const result = await manager.update(
        MetaConnectionEntity,
        { id, organizationId },
        {
          status: "DISCONNECTED",
          disconnectedAt: new Date(),
          disconnectReason: reason,
          credentialCiphertext: null,
          credentialNonce: null,
          credentialAuthTag: null,
          keyVersion: null,
          credentialCreatedAt: null,
          tokenExpiresAt: null,
        },
      );
      return result.affected === 1;
    });
  }

  listAccounts(organizationId: string): Promise<WhatsappAccountEntity[]> {
    return this.run(organizationId, (manager) =>
      manager.find(WhatsappAccountEntity, {
        where: { organizationId },
        order: { createdAt: "DESC" },
      }),
    );
  }

  getAccount(
    organizationId: string,
    id: string,
  ): Promise<WhatsappAccountEntity | null> {
    return this.run(organizationId, (manager) =>
      manager.findOne(WhatsappAccountEntity, { where: { id, organizationId } }),
    );
  }

  listPhoneNumbers(
    organizationId: string,
    accountId: string,
  ): Promise<WhatsappPhoneNumberEntity[]> {
    return this.run(organizationId, (manager) =>
      manager.find(WhatsappPhoneNumberEntity, {
        where: { organizationId, accountId },
        order: { isDefault: "DESC", createdAt: "ASC" },
      }),
    );
  }

  setDefaultPhone(organizationId: string, id: string): Promise<boolean> {
    return this.run(organizationId, async (manager) => {
      const phone = await manager.findOne(WhatsappPhoneNumberEntity, {
        where: { id, organizationId },
      });
      if (!phone) return false;
      await manager.update(
        WhatsappPhoneNumberEntity,
        { organizationId },
        { isDefault: false },
      );
      await manager.update(
        WhatsappPhoneNumberEntity,
        { id, organizationId },
        { isDefault: true },
      );
      return true;
    });
  }

  createDraft(
    organizationId: string,
    userId: string,
    input: DraftInput,
  ): Promise<MessageTemplateEntity> {
    return this.run(organizationId, async (manager) => {
      const account = await manager.findOne(WhatsappAccountEntity, {
        where: { id: input.accountId, organizationId },
      });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");
      const template = await manager.save(
        MessageTemplateEntity,
        manager.create(MessageTemplateEntity, {
          organizationId,
          accountId: input.accountId,
          name: input.name,
          language: input.language,
          category: input.category,
          localStatus: "DRAFT",
          currentVersion: 1,
        }),
      );
      await this.saveVersion(
        manager,
        organizationId,
        userId,
        template,
        input.components,
      );
      return template;
    });
  }

  updateDraft(
    organizationId: string,
    userId: string,
    id: string,
    input: DraftInput,
  ): Promise<MessageTemplateEntity | null> {
    return this.run(organizationId, async (manager) => {
      const template = await manager.findOne(MessageTemplateEntity, {
        where: { id, organizationId },
      });
      if (
        !template ||
        !["DRAFT", "SUBMISSION_FAILED"].includes(template.localStatus)
      )
        return null;
      const account = await manager.findOne(WhatsappAccountEntity, {
        where: { id: input.accountId, organizationId },
      });
      if (!account) throw new Error("ACCOUNT_NOT_FOUND");
      Object.assign(template, {
        accountId: input.accountId,
        name: input.name,
        language: input.language,
        category: input.category,
        localStatus: "DRAFT",
        currentVersion: template.currentVersion + 1,
      });
      const saved = await manager.save(template);
      await this.saveVersion(
        manager,
        organizationId,
        userId,
        saved,
        input.components,
      );
      return saved;
    });
  }

  listTemplates(
    organizationId: string,
    limit: number,
    cursor?: string,
  ): Promise<MessageTemplateEntity[]> {
    return this.run(organizationId, (manager) => {
      const query = manager
        .createQueryBuilder(MessageTemplateEntity, "template")
        .where("template.organization_id = :organizationId", { organizationId })
        .andWhere("template.archived_at IS NULL")
        .orderBy("template.created_at", "DESC")
        .addOrderBy("template.id", "DESC")
        .take(limit);
      if (cursor) query.andWhere("template.id < :cursor", { cursor });
      return query.getMany();
    });
  }

  getTemplate(
    organizationId: string,
    id: string,
  ): Promise<{
    template: MessageTemplateEntity;
    components: TemplateComponentEntity[];
  } | null> {
    return this.run(organizationId, async (manager) => {
      const template = await manager.findOne(MessageTemplateEntity, {
        where: { id, organizationId },
      });
      if (!template) return null;
      const components = await manager.find(TemplateComponentEntity, {
        where: {
          organizationId,
          templateId: id,
          version: template.currentVersion,
        },
        order: { position: "ASC" },
      });
      return { template, components };
    });
  }

  updateTemplateStatus(
    organizationId: string,
    id: string,
    values: Partial<MessageTemplateEntity>,
  ): Promise<void> {
    return this.run(organizationId, async (manager) => {
      await manager.update(
        MessageTemplateEntity,
        { id, organizationId },
        values,
      );
    });
  }

  archiveTemplate(organizationId: string, id: string): Promise<boolean> {
    return this.run(organizationId, async (manager) => {
      const result = await manager.update(
        MessageTemplateEntity,
        { id, organizationId },
        { localStatus: "ARCHIVED", archivedAt: new Date() },
      );
      return result.affected === 1;
    });
  }

  enqueueSync(
    organizationId: string,
    connectionId: string | null,
    type: string,
    cursor: Record<string, unknown> = {},
  ): Promise<IntegrationSyncJobEntity> {
    return this.run(organizationId, (manager) =>
      manager.save(
        IntegrationSyncJobEntity,
        manager.create(IntegrationSyncJobEntity, {
          organizationId,
          connectionId,
          type,
          cursor,
        }),
      ),
    );
  }

  listErrors(
    organizationId: string,
    limit: number,
  ): Promise<IntegrationErrorEntity[]> {
    return this.run(organizationId, (manager) =>
      manager.find(IntegrationErrorEntity, {
        where: { organizationId },
        order: { occurredAt: "DESC" },
        take: limit,
      }),
    );
  }

  recordError(
    organizationId: string,
    connectionId: string | null,
    code: string,
    message: string,
    context: Record<string, unknown> = {},
  ): Promise<IntegrationErrorEntity> {
    return this.run(organizationId, (manager) =>
      manager.save(
        IntegrationErrorEntity,
        manager.create(IntegrationErrorEntity, {
          organizationId,
          connectionId,
          code,
          message,
          context,
        }),
      ),
    );
  }

  saveWebhook(
    deduplicationKey: string,
    payload: Record<string, unknown>,
    expiresAt: Date,
    organizationId: string | null = null,
  ): Promise<{ id: string; created: boolean }> {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const rows = await manager.query(
        `INSERT INTO whatsapp_core.meta_webhook_events(deduplication_key, payload, expires_at,organization_id)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (deduplication_key) DO NOTHING RETURNING id`,
        [deduplicationKey, JSON.stringify(payload), expiresAt, organizationId],
      );
      if (rows[0]?.id) return { id: rows[0].id, created: true };
      const existing = await manager.query(
        `SELECT id FROM whatsapp_core.meta_webhook_events WHERE deduplication_key = $1`,
        [deduplicationKey],
      );
      return { id: existing[0].id, created: false };
    });
  }

  getWebhook(id: string): Promise<MetaWebhookEventEntity | null> {
    return this.tenants.runAsPlatformAdmin((manager) =>
      manager.findOne(MetaWebhookEventEntity, { where: { id } }),
    );
  }

  applyTemplateWebhook(
    eventId: string,
    providerTemplateId: string,
    rawStatus: string,
    normalizedStatus: string,
    reason: string | null,
  ): Promise<boolean> {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const template = await manager.findOne(MessageTemplateEntity, {
        where: { providerTemplateId },
      });
      if (!template) return false;
      await manager.update(
        MessageTemplateEntity,
        { id: template.id },
        {
          metaStatus: normalizedStatus,
          rawProviderStatus: rawStatus,
          rejectionReason: reason,
        },
      );
      await manager.update(
        MetaWebhookEventEntity,
        { id: eventId },
        { organizationId: template.organizationId },
      );
      return true;
    });
  }

  applyMessageStatus(input: {
    providerMessageId: string;
    status: string;
    rawStatus: string;
    providerTimestamp: Date | null;
    deduplicationKey: string;
    errorCode: string | null;
    errorDescription: string | null;
  }): Promise<{
    organizationId: string;
    messageId: string;
    status: string;
    campaignId: string | null;
    campaignCompleted: boolean;
    conversationId: string | null;
  } | null> {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      const rows = await manager.query(
        `SELECT id,organization_id,campaign_id,conversation_id,status FROM whatsapp_core.messages WHERE provider_message_id=$1 FOR UPDATE`,
        [input.providerMessageId],
      );
      const message = rows[0];
      if (!message) return null;
      const inserted = await manager.query(
        `INSERT INTO whatsapp_core.message_status_events(organization_id,message_id,deduplication_key,status,raw_status,provider_timestamp,error_code,error_description)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(deduplication_key) DO NOTHING RETURNING id`,
        [
          message.organization_id,
          message.id,
          input.deduplicationKey,
          input.status,
          input.rawStatus,
          input.providerTimestamp,
          input.errorCode,
          input.errorDescription,
        ],
      );
      if (!inserted.length) return null;
      const rank: Record<string, number> = {
        CREATED: 0,
        QUEUED: 1,
        SUBMITTING: 2,
        ACCEPTED: 3,
        SENT: 4,
        FAILED: 4,
        DELIVERED: 5,
        READ: 6,
        CANCELLED: 7,
        UNKNOWN_SUBMISSION: 2,
      };
      if ((rank[input.status] ?? -1) < (rank[message.status] ?? -1))
        return null;
      await manager.query(
        `UPDATE whatsapp_core.messages SET status=$2,raw_provider_status=$3,error_code=$4,error_description=$5,
          sent_at=CASE WHEN $2 IN ('SENT','DELIVERED','READ') THEN coalesce(sent_at,$6,now()) ELSE sent_at END,
          delivered_at=CASE WHEN $2 IN ('DELIVERED','READ') THEN coalesce(delivered_at,$6,now()) ELSE delivered_at END,
          read_at=CASE WHEN $2='READ' THEN coalesce($6,read_at,now()) ELSE read_at END,
          failed_at=CASE WHEN $2='FAILED' THEN coalesce($6,failed_at,now()) ELSE failed_at END,updated_at=now() WHERE id=$1`,
        [
          message.id,
          input.status,
          input.rawStatus,
          input.errorCode,
          input.errorDescription,
          input.providerTimestamp,
        ],
      );
      const completed = message.campaign_id
        ? await manager.query(
            `UPDATE whatsapp_core.campaigns c SET status='COMPLETED',version=version+1,updated_at=now()
           WHERE c.id=$1 AND c.organization_id=$2 AND c.status='RUNNING'
             AND EXISTS(SELECT 1 FROM whatsapp_core.messages msg WHERE msg.campaign_id=c.id)
             AND NOT EXISTS(SELECT 1 FROM whatsapp_core.messages msg WHERE msg.campaign_id=c.id AND msg.status NOT IN ('DELIVERED','READ','FAILED','CANCELLED')) RETURNING c.id`,
            [message.campaign_id, message.organization_id],
          )
        : [];
      return {
        organizationId: message.organization_id,
        messageId: message.id,
        status: input.status,
        campaignId: message.campaign_id,
        campaignCompleted: completed.length > 0,
        conversationId: message.conversation_id,
      };
    });
  }

  finishWebhook(id: string, status: string): Promise<void> {
    return this.tenants.runAsPlatformAdmin(async (manager) => {
      await manager.update(
        MetaWebhookEventEntity,
        { id },
        { status, processedAt: new Date() },
      );
    });
  }

  private async saveVersion(
    manager: EntityManager,
    organizationId: string,
    userId: string,
    template: MessageTemplateEntity,
    components: DraftInput["components"],
  ): Promise<void> {
    await manager.save(
      TemplateComponentEntity,
      components.map((component, position) =>
        manager.create(TemplateComponentEntity, {
          organizationId,
          templateId: template.id,
          version: template.currentVersion,
          position,
          ...component,
        }),
      ),
    );
    await manager.save(
      TemplateVersionEntity,
      manager.create(TemplateVersionEntity, {
        organizationId,
        templateId: template.id,
        version: template.currentVersion,
        snapshot: {
          name: template.name,
          language: template.language,
          category: template.category,
          components,
        },
        createdByUserId: userId,
      }),
    );
  }
}
