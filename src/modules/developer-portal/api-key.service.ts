import { Injectable } from "@nestjs/common";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { AppConfigService } from "../../default/config/config.service";
import { AuditRepository } from "../audit/audit.repository";
import { FieldEncryptionService } from "../security/encryption/field-encryption.service";
import {
  CreateApiKeyDto,
  RevokeApiKeyDto,
  RotateApiKeyDto,
} from "./dto/developer-portal.dto";
import { DeveloperPortalRepository } from "./developer-portal.repository";
import { Request } from "express";
import { BusinessException } from "../../default/error/business.exception";
import { ERROR_CODES } from "../../default/error/error.code";

@Injectable()
export class ApiKeyService {
  private readonly hashSecret: string;

  constructor(
    private readonly repo: DeveloperPortalRepository,
    private readonly config: AppConfigService,
    private readonly audit: AuditRepository,
    private readonly encryption: FieldEncryptionService,
  ) {
    this.hashSecret = this.config.get<string>("API_KEY_HASH_SECRET", "");
    if (this.hashSecret.length < 32)
      throw new Error(
        "API_KEY_HASH_SECRET must contain at least 32 characters",
      );
  }

  list(org: string) {
    return this.repo.listKeys(org);
  }

  async create(org: string, user: string, dto: CreateApiKeyDto) {
    await this.assertScopes(org, user, dto.scopes);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    this.assertFutureExpiration(expiresAt);
    const prefix = dto.environment === "LIVE" ? "live" : "test";
    const publicId = randomBytes(9).toString("base64url");
    const secret = randomBytes(32).toString("base64url");
    const rawKey = `wsa_${prefix}_${publicId}_${secret}`;
    const id = randomUUID();
    const signingSecret = `wss_${randomBytes(32).toString("base64url")}`;
    const encrypted = await this.encryption.encrypt(
      Buffer.from(signingSecret),
      this.signingContext(org, id),
    );
    const key = await this.repo.createKey(org, user, {
      id,
      name: dto.name,
      publicId,
      verifier: this.verifier(rawKey),
      environment: dto.environment,
      expiresAt,
      scopes: dto.scopes,
      networks: dto.ipAllowlist,
      mtlsFingerprints: this.normalizeFingerprints(dto.mtlsFingerprints),
      encryptedSigningSecret: encrypted,
    });
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.api_key.created",
      resourceType: "api_key",
      resourceId: key.id,
      metadata: { environment: dto.environment, scopes: dto.scopes },
    });
    return { ...key, secret: rawKey, signingSecret };
  }

  async rotate(org: string, user: string, id: string, dto: RotateApiKeyDto) {
    const current = await this.repo.getKey(org, id);
    if (!current)
      throw new BusinessException(ERROR_CODES.DEVELOPER.API_KEY_NOT_FOUND);
    if (current.status !== "ACTIVE")
      throw new BusinessException(
        ERROR_CODES.DEVELOPER.API_KEY_ROTATION_INVALID,
      );
    const prefix = current.environment === "LIVE" ? "live" : "test";
    const publicId = randomBytes(9).toString("base64url");
    const secret = randomBytes(32).toString("base64url");
    const rawKey = `wsa_${prefix}_${publicId}_${secret}`;
    const keyId = randomUUID();
    const signingSecret = `wss_${randomBytes(32).toString("base64url")}`;
    const encrypted = await this.encryption.encrypt(
      Buffer.from(signingSecret),
      this.signingContext(org, keyId),
    );
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : current.expires_at
        ? new Date(current.expires_at)
        : null;
    this.assertFutureExpiration(expiresAt);
    const key = await this.repo.createKey(org, user, {
      id: keyId,
      name: `${current.name} (rotated)`.slice(0, 100),
      publicId,
      verifier: this.verifier(rawKey),
      environment: current.environment,
      expiresAt,
      scopes: current.scopes,
      networks: current.ip_allowlist,
      mtlsFingerprints: current.mtls_fingerprints,
      encryptedSigningSecret: encrypted,
      rotatedFromId: id,
    });
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.api_key.rotated",
      resourceType: "api_key",
      resourceId: key.id,
      metadata: { rotatedFromId: id },
    });
    return { ...key, secret: rawKey, signingSecret };
  }

  async revoke(org: string, user: string, id: string, dto: RevokeApiKeyDto) {
    const result = await this.repo.revokeKey(org, id, user, dto.reason ?? null);
    if (!result)
      throw new BusinessException(
        ERROR_CODES.DEVELOPER.ACTIVE_API_KEY_NOT_FOUND,
      );
    await this.audit.append(org, {
      actorUserId: user,
      action: "developer.api_key.revoked",
      resourceType: "api_key",
      resourceId: id,
      metadata: { reason: dto.reason ?? null },
    });
    return result;
  }

  verifier(rawKey: string) {
    return createHmac("sha256", this.hashSecret).update(rawKey).digest("hex");
  }

  verify(rawKey: string, verifier: string) {
    const expected = Buffer.from(verifier, "hex");
    const actual = Buffer.from(this.verifier(rawKey), "hex");
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  async signingSecret(record: any) {
    if (
      !record.signing_secret_ciphertext ||
      !record.signing_secret_nonce ||
      !record.signing_secret_auth_tag ||
      !record.signing_key_version
    )
      return null;
    return (
      await this.encryption.decrypt(
        {
          ciphertext: record.signing_secret_ciphertext,
          nonce: record.signing_secret_nonce,
          authTag: record.signing_secret_auth_tag,
          keyVersion: record.signing_key_version,
        },
        this.signingContext(record.organization_id, record.id),
      )
    ).toString("utf8");
  }

  hasAuthorizedClientCertificate(record: any, request: Request) {
    if (!record.mtls_required) return true;
    const socket = request.socket as any;
    if (!socket.authorized || typeof socket.getPeerCertificate !== "function")
      return false;
    const fingerprint = String(
      socket.getPeerCertificate()?.fingerprint256 ?? "",
    )
      .replaceAll(":", "")
      .toLowerCase();
    return (
      fingerprint.length === 64 &&
      record.mtls_fingerprints.includes(fingerprint)
    );
  }

  private signingContext(org: string, id: string) {
    return `api-signing:${org}:${id}`;
  }

  private normalizeFingerprints(values: string[]) {
    return values.map((value) => value.replaceAll(":", "").toLowerCase());
  }

  private async assertScopes(org: string, user: string, scopes: string[]) {
    const scopePermissions: Record<string, string> = {
      "messages:send": "messages.send",
      "messages:read": "messages.read",
      "templates:read": "whatsapp.template.read",
      "contacts:read": "contacts.read",
      "contacts:write": "contacts.manage",
      "campaigns:read": "campaigns.read",
      "campaigns:manage": "campaigns.manage",
      "reports:read": "analytics.read",
      "webhooks:manage": "developer.webhook.manage",
    };
    const permissions = new Set(await this.repo.userPermissions(org, user));
    const denied = scopes.filter(
      (scope) => !permissions.has(scopePermissions[scope]),
    );
    if (denied.length)
      throw new BusinessException(
        ERROR_CODES.DEVELOPER.API_KEY_SCOPES_FORBIDDEN,
        { scopes: denied.join(", ") },
      );
  }

  private assertFutureExpiration(value: Date | null) {
    if (value && value <= new Date())
      throw new BusinessException(
        ERROR_CODES.DEVELOPER.API_KEY_EXPIRATION_INVALID,
      );
  }
}
