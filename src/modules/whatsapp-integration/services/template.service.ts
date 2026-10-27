import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditRepository } from "../../audit/audit.repository";
import { FieldEncryptionService } from "../../security/encryption/field-encryption.service";
import {
  DuplicateTemplateDto,
  SaveTemplateDto,
} from "../dto/whatsapp-integration.dto";
import { MetaGraphProvider } from "../providers/meta-graph.provider";
import { WhatsappIntegrationRepository } from "../repositories/whatsapp-integration.repository";
import { TemplatePayloadValidator } from "../validators/template-payload.validator";
import { EntitlementService } from "../../billing/services/entitlement.service";
import { ForbiddenException } from "@nestjs/common";

@Injectable()
export class TemplateService {
  constructor(
    private readonly repository: WhatsappIntegrationRepository,
    private readonly validator: TemplatePayloadValidator,
    private readonly meta: MetaGraphProvider,
    private readonly encryption: FieldEncryptionService,
    private readonly audit: AuditRepository,
    private readonly entitlements: EntitlementService,
  ) {}

  list(organizationId: string, limit: number, cursor?: string) {
    return this.repository.listTemplates(organizationId, limit, cursor);
  }

  async get(organizationId: string, id: string) {
    const result = await this.repository.getTemplate(organizationId, id);
    if (!result) throw new NotFoundException("Template not found");
    return result;
  }

  async create(organizationId: string, userId: string, input: SaveTemplateDto) {
    await this.requirePaidMeta(organizationId);
    this.validator.validate(input.components);
    try {
      const template = await this.repository.createDraft(
        organizationId,
        userId,
        input,
      );
      await this.audit.append(organizationId, {
        actorUserId: userId,
        action: "whatsapp.template.created",
        resourceType: "message_template",
        resourceId: template.id,
        metadata: { name: template.name, language: template.language },
      });
      return template;
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: SaveTemplateDto,
  ) {
    await this.requirePaidMeta(organizationId);
    this.validator.validate(input.components);
    try {
      const template = await this.repository.updateDraft(
        organizationId,
        userId,
        id,
        input,
      );
      if (!template)
        throw new ConflictException(
          "Only drafts or failed submissions can be edited",
        );
      await this.audit.append(organizationId, {
        actorUserId: userId,
        action: "whatsapp.template.updated",
        resourceType: "message_template",
        resourceId: template.id,
        metadata: { version: template.currentVersion },
      });
      return template;
    } catch (error) {
      this.mapRepositoryError(error);
    }
  }

  async duplicate(
    organizationId: string,
    userId: string,
    id: string,
    input: DuplicateTemplateDto,
  ) {
    const source = await this.get(organizationId, id);
    return this.create(organizationId, userId, {
      accountId: source.template.accountId,
      name: input.name,
      language: source.template.language,
      category: source.template.category,
      components: source.components.map((component) => ({
        type: component.type,
        payload: component.payload,
      })),
    });
  }

  async submit(organizationId: string, userId: string, id: string) {
    await this.requirePaidMeta(organizationId);
    const source = await this.get(organizationId, id);
    if (!["DRAFT", "SUBMISSION_FAILED"].includes(source.template.localStatus)) {
      throw new ConflictException("Template is not eligible for submission");
    }
    const account = await this.repository.getAccount(
      organizationId,
      source.template.accountId,
    );
    if (!account) throw new NotFoundException("WhatsApp account not found");
    const connection = await this.repository.getConnection(
      organizationId,
      account.connectionId,
      true,
    );
    if (
      !connection ||
      connection.status !== "CONNECTED" ||
      !connection.credentialCiphertext ||
      !connection.credentialNonce ||
      !connection.credentialAuthTag ||
      !connection.keyVersion
    ) {
      throw new ConflictException("WhatsApp connection requires authorization");
    }

    await this.repository.updateTemplateStatus(organizationId, id, {
      localStatus: "SUBMITTING",
    });
    const token = (
      await this.encryption.decrypt(
        {
          ciphertext: connection.credentialCiphertext,
          nonce: connection.credentialNonce,
          authTag: connection.credentialAuthTag,
          keyVersion: connection.keyVersion,
        },
        `meta:${organizationId}`,
      )
    ).toString("utf8");

    try {
      const provider = await this.meta.createTemplate(
        token,
        account.providerAccountId,
        {
          name: source.template.name,
          language: source.template.language,
          category: source.template.category,
          components: source.components.map((component) => ({
            type: component.type,
            ...this.toProviderPayload(component.type, component.payload),
          })),
        },
      );
      await this.repository.updateTemplateStatus(organizationId, id, {
        providerTemplateId: provider.id ?? null,
        localStatus: "SUBMITTED",
        metaStatus: this.normalizeStatus(provider.status),
        rawProviderStatus: provider.status ?? null,
      });
      await this.audit.append(organizationId, {
        actorUserId: userId,
        action: "whatsapp.template.submitted",
        resourceType: "message_template",
        resourceId: id,
        metadata: { providerTemplateId: provider.id ?? null },
      });
      return this.get(organizationId, id);
    } catch {
      await this.repository.updateTemplateStatus(organizationId, id, {
        localStatus: "SUBMISSION_FAILED",
      });
      await this.repository.recordError(
        organizationId,
        account.connectionId,
        "META_TEMPLATE_SUBMISSION_UNCERTAIN",
        "Meta did not confirm the template submission outcome",
        { templateId: id },
      );
      await this.repository.enqueueSync(
        organizationId,
        account.connectionId,
        "RECONCILE_SUBMISSION",
        { templateId: id },
      );
      throw new BadGatewayException(
        "Meta did not confirm submission; reconciliation has been queued to avoid duplicates",
      );
    }
  }

  async archive(organizationId: string, userId: string, id: string) {
    if (!(await this.repository.archiveTemplate(organizationId, id))) {
      throw new NotFoundException("Template not found");
    }
    await this.audit.append(organizationId, {
      actorUserId: userId,
      action: "whatsapp.template.archived",
      resourceType: "message_template",
      resourceId: id,
      metadata: {},
    });
  }

  async sync(organizationId: string) {
    await this.requirePaidMeta(organizationId);
    return this.repository.enqueueSync(organizationId, null, "TEMPLATES");
  }

  private async requirePaidMeta(organizationId: string) {
    if (!(await this.entitlements.canUseFeature(organizationId, "meta_integration")))
      throw new ForbiddenException("A paid subscription is required for templates");
  }

  private toProviderPayload(type: string, payload: Record<string, unknown>) {
    const result = { ...payload } as Record<string, unknown>;
    const examples = result.examples;
    delete result.examples;
    if (Array.isArray(examples) && examples.length) {
      result.example =
        type === "BODY" ? { body_text: [examples] } : { header_text: examples };
    }
    const exampleHandle = result.exampleHandle;
    delete result.exampleHandle;
    if (typeof exampleHandle === "string") {
      result.example = { header_handle: [exampleHandle] };
    }
    return result;
  }

  private normalizeStatus(status?: string): string | null {
    if (!status) return null;
    const normalized = status.toUpperCase();
    return ["APPROVED", "REJECTED", "PENDING", "PAUSED", "DISABLED"].includes(
      normalized,
    )
      ? normalized
      : "UNKNOWN";
  }

  private mapRepositoryError(error: unknown): never {
    if ((error as Error).message === "ACCOUNT_NOT_FOUND") {
      throw new NotFoundException("WhatsApp account not found");
    }
    if ((error as { code?: string }).code === "23505") {
      throw new ConflictException(
        "A template with this account, name, and language already exists",
      );
    }
    throw error;
  }
}
