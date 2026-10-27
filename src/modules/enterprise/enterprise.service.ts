import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { DataSource } from "typeorm";
import { AuditRepository } from "../audit/audit.repository";
import { WebhookDestinationPolicy } from "../developer-portal/webhook-destination.policy";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import { PasswordHasherService } from "../security/password-hasher.service";
import {
  CreateIncidentDto,
  CreatePrivacyRequestDto,
  CreateSsoDto,
  RecordBackupVerificationDto,
  ReviewPrivacyRequestDto,
  RevokeEnterpriseSessionsDto,
  UpdateIncidentDto,
  UpdateRetentionPolicyDto,
  UpdateSecurityPolicyDto,
  UpdateSsoDto,
} from "./dto/enterprise.dto";
import { EnterpriseRepository } from "./enterprise.repository";

@Injectable()
export class EnterpriseService {
  constructor(
    private readonly repo: EnterpriseRepository,
    private readonly encryption: FieldEncryptionService,
    private readonly destinations: WebhookDestinationPolicy,
    private readonly passwords: PasswordHasherService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditRepository,
  ) {}

  policy(org: string) {
    return this.repo.policy(org);
  }

  async updatePolicy(org: string, user: string, dto: UpdateSecurityPolicyDto) {
    if (dto.passwordLoginEnabled === false)
      throw new BadRequestException(
        "Password login cannot be disabled until OIDC sign-in is available",
      );
    if (
      dto.idleTimeoutMinutes &&
      dto.sessionLifetimeMinutes &&
      dto.idleTimeoutMinutes > dto.sessionLifetimeMinutes
    )
      throw new BadRequestException(
        "Idle timeout cannot exceed session lifetime",
      );
    if (dto.requireMfa && (await this.repo.membersWithoutMfa(org)) > 0)
      throw new ConflictException(
        "Every active member must enroll MFA before it can be required",
      );
    const value = await this.repo.updatePolicy(org, user, dto);
    await this.audit.append(org, {
      actorUserId: user,
      action: "enterprise.security_policy.updated",
      resourceType: "organization_security_policy",
      metadata: { changedFields: Object.keys(dto) },
    });
    return value;
  }

  sso(org: string) {
    return this.repo.sso(org);
  }

  async createSso(org: string, user: string, dto: CreateSsoDto) {
    if (dto.enabled)
      throw new BadRequestException(
        "OIDC sign-in is not available; save and test the connection as disabled",
      );
    const domains = this.domains(dto.allowedDomains);
    await this.destinations.assertPublicHttps(dto.issuerUrl);
    const id = randomUUID();
    const secret = await this.encryption.encrypt(
      Buffer.from(dto.clientSecret),
      `enterprise-sso:${org}:${id}`,
    );
    const value = await this.repo.createSso(
      org,
      user,
      id,
      { ...dto, allowedDomains: domains },
      secret,
    );
    await this.audit.append(org, {
      actorUserId: user,
      action: "enterprise.sso.created",
      resourceType: "enterprise_sso_connection",
      resourceId: id,
      metadata: { issuerHost: new URL(dto.issuerUrl).hostname },
    });
    return value;
  }

  async updateSso(org: string, user: string, id: string, dto: UpdateSsoDto) {
    if (dto.enabled)
      throw new BadRequestException("OIDC sign-in is not available");
    const clean = {
      ...dto,
      ...(dto.allowedDomains
        ? { allowedDomains: this.domains(dto.allowedDomains) }
        : {}),
    };
    const secret = dto.clientSecret
      ? await this.encryption.encrypt(
          Buffer.from(dto.clientSecret),
          `enterprise-sso:${org}:${id}`,
        )
      : undefined;
    const value = await this.repo.updateSso(org, id, clean, secret);
    if (!value) throw new NotFoundException("SSO connection not found");
    await this.audit.append(org, {
      actorUserId: user,
      action: "enterprise.sso.updated",
      resourceType: "enterprise_sso_connection",
      resourceId: id,
      metadata: {
        changedFields: Object.keys(dto).filter(
          (field) => field !== "clientSecret",
        ),
        secretRotated: Boolean(dto.clientSecret),
      },
    });
    return value;
  }

  async testSso(org: string, id: string) {
    const connection = await this.repo.ssoIssuer(org, id);
    if (!connection) throw new NotFoundException("SSO connection not found");
    try {
      const issuer = String(connection.issuer_url).replace(/\/$/, "");
      const target = `${issuer}/.well-known/openid-configuration`;
      await this.destinations.assertPublicHttps(target);
      const response = await fetch(target, {
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const metadata = (await response.json()) as Record<string, unknown>;
      if (
        metadata.issuer !== issuer ||
        typeof metadata.authorization_endpoint !== "string" ||
        typeof metadata.token_endpoint !== "string" ||
        typeof metadata.jwks_uri !== "string"
      )
        throw new Error("OIDC discovery metadata is incomplete or mismatched");
      for (const endpoint of [
        metadata.authorization_endpoint,
        metadata.token_endpoint,
        metadata.jwks_uri,
      ])
        await this.destinations.assertPublicHttps(String(endpoint));
      await this.repo.recordSsoTest(org, id, true);
      return { status: "SUCCESS", issuer };
    } catch (error: any) {
      const message = String(error?.message ?? "OIDC discovery failed").slice(
        0,
        500,
      );
      await this.repo.recordSsoTest(org, id, false, message);
      throw new BadRequestException(`SSO test failed: ${message}`);
    }
  }

  async deleteSso(org: string, user: string, id: string) {
    const value = await this.repo.deleteSso(org, id);
    if (!value) throw new NotFoundException("SSO connection not found");
    await this.audit.append(org, {
      actorUserId: user,
      action: "enterprise.sso.deleted",
      resourceType: "enterprise_sso_connection",
      resourceId: id,
    });
    return { id, deleted: true };
  }

  privacy(org: string) {
    return this.repo.privacy(org);
  }
  async privacyRequest(org: string, id: string) {
    const value = await this.repo.privacyRequest(org, id);
    if (!value) throw new NotFoundException("Privacy request not found");
    return value;
  }

  async createPrivacy(org: string, user: string, dto: CreatePrivacyRequestDto) {
    const [account] = await this.dataSource.query(
      `SELECT password_hash FROM whatsapp_core.users WHERE id=$1 AND status='ACTIVE'`,
      [user],
    );
    if (
      !account?.password_hash ||
      !(await this.passwords.verify(account.password_hash, dto.password))
    )
      throw new UnauthorizedException("Reauthentication failed");
    const dueAt = new Date(
      Date.now() +
        (dto.jurisdiction === "CCPA" ? 45 : 30) * 24 * 60 * 60 * 1000,
    );
    const value = await this.repo.createPrivacy(org, user, dto, dueAt);
    if (!value)
      throw new NotFoundException("Privacy request subject not found");
    await this.audit.append(org, {
      actorUserId: user,
      action: "privacy.request.created",
      resourceType: "privacy_request",
      resourceId: value.id,
      metadata: {
        requestType: dto.requestType,
        jurisdiction: dto.jurisdiction,
      },
    });
    return value;
  }

  retention(org: string) {
    return this.repo.retention(org);
  }
  deletionJobs(org: string) {
    return this.repo.deletionJobs(org);
  }
  async updateRetention(
    org: string,
    user: string,
    id: string,
    dto: UpdateRetentionPolicyDto,
  ) {
    const value = await this.repo.updateRetention(org, user, id, dto);
    if (!value) throw new NotFoundException("Retention policy not found");
    await this.audit.append(org, {
      actorUserId: user,
      action: "enterprise.retention.updated",
      resourceType: "data_retention_policy",
      resourceId: id,
      metadata: {
        retentionDays: dto.retentionDays,
        deletionMethod: dto.deletionMethod,
        legalHold: dto.legalHold,
      },
    });
    return value;
  }

  residency(org: string) {
    return this.repo.residency(org);
  }
  sessions(org: string) {
    return this.repo.sessions(org);
  }
  revokeSessions(org: string, actor: string, dto: RevokeEnterpriseSessionsDto) {
    return this.repo
      .revokeSessions(org, actor, dto.userId, dto.reason)
      .then((count) => ({ revoked: count }));
  }

  platformHealth() {
    return this.repo.platformHealth();
  }
  incidents() {
    return this.repo.incidents();
  }
  createIncident(admin: { id: string; role: string }, dto: CreateIncidentDto) {
    this.assertSecurityAdmin(admin);
    return this.repo.createIncident(admin.id, dto);
  }
  async updateIncident(
    admin: { id: string; role: string },
    id: string,
    dto: UpdateIncidentDto,
  ) {
    this.assertSecurityAdmin(admin);
    const value = await this.repo.updateIncident(admin.id, id, dto);
    if (!value) throw new NotFoundException("Security incident not found");
    return value;
  }
  adminPrivacy() {
    return this.repo.adminPrivacy();
  }
  async reviewPrivacy(
    admin: { id: string; role: string },
    id: string,
    dto: ReviewPrivacyRequestDto,
  ) {
    this.assertSecurityAdmin(admin);
    const value = await this.repo.reviewPrivacy(admin.id, id, dto);
    if (!value) throw new NotFoundException("Privacy request not found");
    return value;
  }
  tenantSecurity() {
    return this.repo.tenantSecurity();
  }
  tenantResidency() {
    return this.repo.tenantResidency();
  }
  backups() {
    return this.repo.backups();
  }
  recordBackup(
    admin: { id: string; role: string },
    dto: RecordBackupVerificationDto,
  ) {
    this.assertSecurityAdmin(admin);
    return this.repo.recordBackup(admin.id, dto);
  }
  platformAudit() {
    return this.repo.platformAudit();
  }

  private domains(values: string[]) {
    const domains = [
      ...new Set(values.map((value) => value.trim().toLowerCase())),
    ];
    if (
      domains.length < 1 ||
      domains.length > 100 ||
      domains.some(
        (domain) =>
          !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
            domain,
          ),
      )
    )
      throw new BadRequestException("Allowed SSO domains are invalid");
    return domains;
  }

  private assertSecurityAdmin(admin: { role: string }) {
    if (!["SUPER_ADMIN", "SECURITY_ADMIN"].includes(admin.role))
      throw new ForbiddenException("Security administrator access required");
  }
}
