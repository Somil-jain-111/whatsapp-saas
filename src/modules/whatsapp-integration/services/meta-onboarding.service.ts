import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { AuditRepository } from "../../audit/audit.repository";
import { FieldEncryptionService } from "../../security/encryption/field-encryption.service";
import { AppConfigService } from "../../../default/config/config.service";
import {
  CompleteOnboardingDto,
} from "../dto/whatsapp-integration.dto";
import { MetaGraphProvider } from "../providers/meta-graph.provider";
import { WhatsappIntegrationRepository } from "../repositories/whatsapp-integration.repository";
import { EntitlementService } from "../../billing/services/entitlement.service";

@Injectable()
export class MetaOnboardingService {
  constructor(
    private readonly repository: WhatsappIntegrationRepository,
    private readonly meta: MetaGraphProvider,
    private readonly encryption: FieldEncryptionService,
    private readonly config: AppConfigService,
    private readonly audit: AuditRepository,
    private readonly entitlements: EntitlementService,
  ) {}

  appConfiguration(_organizationId: string) {
    return {
      configured: this.config.get<boolean>("META_INTEGRATION_ENABLED", false),
      mode: "PLATFORM",
    };
  }

  async start(organizationId: string, userId: string) {
    await this.requirePaidMeta(organizationId);
    if (!this.config.get<boolean>("META_INTEGRATION_ENABLED", false)) {
      return {
        configurationRequired: true,
        mode: "PLATFORM",
        message: "Platform Meta onboarding is not configured.",
      };
    }
    const state = randomBytes(32).toString("base64url");
    const ttl = this.config.get<number>("META_ONBOARDING_TTL_SECONDS", 600);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.repository.createOnboardingSession(
      organizationId,
      userId,
      this.hash(state),
      expiresAt,
    );
    return {
      state,
      expiresAt,
      ...this.meta.publicConfiguration(),
    };
  }

  async complete(
    organizationId: string,
    userId: string,
    input: CompleteOnboardingDto,
  ) {
    await this.requirePaidMeta(organizationId);
    const consumed = await this.repository.consumeOnboardingSession(
      organizationId,
      userId,
      this.hash(input.state),
    );
    if (!consumed)
      throw new UnauthorizedException(
        "Invalid, expired, or already-used onboarding state",
      );

    let credential: Awaited<ReturnType<MetaGraphProvider["exchangeCode"]>>;
    let account: Awaited<ReturnType<MetaGraphProvider["getAccount"]>>;
    let phones: Awaited<ReturnType<MetaGraphProvider["getPhoneNumbers"]>>;
    try {
      credential = await this.meta.exchangeCode(input.code);
      const providerCredential = this.meta.encodeCredential(credential.accessToken);
      account = await this.meta.getAccount(
        providerCredential,
        input.wabaId,
      );
      if (account.id !== input.wabaId) {
        throw new UnauthorizedException("Authorized account mismatch");
      }
      phones = await this.meta.getPhoneNumbers(
        providerCredential,
        account.id,
      );
      await this.meta.subscribeApp(providerCredential, account.id);
    } catch (error) {
      await this.repository.recordError(
        organizationId,
        null,
        "META_ONBOARDING_FAILED",
        "Meta authorization or asset synchronization failed",
        {
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
      );
      throw error;
    }
    const encrypted = await this.encryption.encrypt(
      Buffer.from(
        this.meta.encodeCredential(credential.accessToken),
        "utf8",
      ),
      `meta:${organizationId}`,
    );

    try {
      const connection = await this.repository.saveConnectedAssets(
        organizationId,
        encrypted,
        credential.expiresIn
          ? new Date(Date.now() + credential.expiresIn * 1000)
          : null,
        {
          id: account.id,
          name: account.name,
          status: account.account_review_status,
          verificationStatus: account.business_verification_status,
        },
        phones.map((phone) => ({
          id: phone.id,
          displayPhoneNumber: phone.display_phone_number,
          phoneE164: this.toE164(phone.display_phone_number),
          verifiedName: phone.verified_name,
          qualityRating: phone.quality_rating,
          messagingLimit: phone.messaging_limit_tier,
          status: phone.code_verification_status ?? phone.name_status,
        })),
      );
      await this.audit.append(organizationId, {
        actorUserId: userId,
        action: "meta.connection.created",
        resourceType: "meta_connection",
        resourceId: connection.id,
        metadata: { accountId: account.id, phoneCount: phones.length },
      });
      return connection;
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new ConflictException("This Meta account is already connected");
      }
      throw error;
    }
  }

  list(organizationId: string) {
    return this.repository.listConnections(organizationId);
  }

  async get(organizationId: string, id: string) {
    const connection = await this.repository.getConnection(organizationId, id);
    if (!connection) throw new NotFoundException("Connection not found");
    return connection;
  }

  async sync(organizationId: string, id: string) {
    await this.requirePaidMeta(organizationId);
    const connection = await this.get(organizationId, id);
    if (
      !["CONNECTED", "DEGRADED", "ACTION_REQUIRED"].includes(connection.status)
    ) {
      throw new ConflictException(
        "Disconnected connections cannot be synchronized",
      );
    }
    return this.repository.enqueueSync(organizationId, id, "CONNECTION");
  }

  async disconnect(
    organizationId: string,
    userId: string,
    id: string,
    reason: string,
  ) {
    if (!(await this.repository.disconnect(organizationId, id, reason))) {
      throw new NotFoundException("Connection not found");
    }
    await this.audit.append(organizationId, {
      actorUserId: userId,
      action: "meta.connection.disconnected",
      resourceType: "meta_connection",
      resourceId: id,
      metadata: { reason },
    });
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async requirePaidMeta(organizationId: string) {
    if (!(await this.entitlements.canUseFeature(organizationId, "meta_integration")))
      throw new ForbiddenException("A paid subscription is required to connect Meta");
  }

  private toE164(value: string): string | null {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 2 && digits.length <= 15 ? `+${digits}` : null;
  }
}
