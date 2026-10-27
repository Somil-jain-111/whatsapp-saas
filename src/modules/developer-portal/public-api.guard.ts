import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { validate as isUuid, v4 as uuid } from "uuid";
import { RedisService } from "../../default/databases/redis/redis.service";
import { AppConfigService } from "../../default/config/config.service";
import { ApiKeyService } from "./api-key.service";
import { PUBLIC_API_SCOPE } from "./api-scope.decorator";
import { PublicApiRequest } from "./developer-request.interface";
import { DeveloperPortalRepository } from "./developer-portal.repository";
import { ApiScope } from "./dto/developer-portal.dto";
import {
  OAuthTokenService,
  PublicAccessTokenClaims,
} from "./oauth-token.service";

@Injectable()
export class PublicApiGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: ApiKeyService,
    private readonly repo: DeveloperPortalRepository,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
    private readonly tokens: OAuthTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PublicApiRequest>();
    const response = context.switchToHttp().getResponse();
    request.requestId = this.requestId(request.header("x-request-id"));
    response.setHeader("X-Request-Id", request.requestId);
    if (this.config.isProduction() && !request.secure)
      throw new ForbiddenException({
        code: "HTTPS_REQUIRED",
        message: "Public API requests require HTTPS.",
      });
    const sourceIp = this.sourceIp(request.ip);
    const authenticated = await this.authenticate(request, sourceIp);
    const record = authenticated.record;
    if (!record) {
      await this.repo.appendSecurityEvent({
        eventType: "API_KEY_AUTHENTICATION_FAILED",
        severity: "MEDIUM",
        sourceIp,
      });
      this.unauthorized("API_KEY_INVALID");
    }
    if (record.status === "REVOKED") this.unauthorized("API_KEY_REVOKED");
    if (record.expires_at && new Date(record.expires_at) <= new Date())
      this.unauthorized("API_KEY_EXPIRED");
    if (record.organization_status !== "ACTIVE" || !record.api_access_enabled)
      throw new ForbiddenException({
        code: "TENANT_API_DISABLED",
        message: "API access is disabled for this organization.",
      });
    if (!record.subscription_active)
      throw new HttpException(
        {
          code: "SUBSCRIPTION_REQUIRED",
          message: "An active plan is required.",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    if (record.allowlist_count > 0 && !record.ip_allowed) {
      await this.repo.appendSecurityEvent({
        organizationId: record.organization_id,
        apiKeyId: record.id,
        eventType: "API_KEY_IP_DENIED",
        severity: "HIGH",
        sourceIp,
      });
      throw new ForbiddenException({
        code: "SOURCE_IP_DENIED",
        message: "The source IP is not allowed for this credential.",
      });
    }
    if (!this.keys.hasAuthorizedClientCertificate(record, request)) {
      await this.repo.appendSecurityEvent({
        organizationId: record.organization_id,
        apiKeyId: record.id,
        eventType: "API_MTLS_CERTIFICATE_DENIED",
        severity: "HIGH",
        sourceIp,
      });
      throw new ForbiddenException({
        code: "CLIENT_CERTIFICATE_REQUIRED",
        message:
          "A trusted client certificate is required for this credential.",
      });
    }
    const required = this.reflector.getAllAndOverride<ApiScope>(
      PUBLIC_API_SCOPE,
      [context.getHandler(), context.getClass()],
    );
    const scopes = authenticated.scopes ?? record.scopes;
    if (required && !scopes.includes(required))
      throw new ForbiddenException({
        code: "SCOPE_REQUIRED",
        message: `The ${required} scope is required.`,
      });

    const minute = Math.floor(Date.now() / 60000);
    const [keyCount, orgCount] = await Promise.all([
      this.redis.incrementWithExpiry(
        `public-api:key:${record.id}:${minute}`,
        65,
      ),
      this.redis.incrementWithExpiry(
        `public-api:org:${record.organization_id}:${minute}`,
        65,
      ),
    ]);
    const keyLimit = this.config.get<number>(
      "PUBLIC_API_KEY_RATE_PER_MINUTE",
      60,
    );
    const orgLimit = this.config.get<number>(
      "PUBLIC_API_ORG_RATE_PER_MINUTE",
      300,
    );
    response.setHeader("X-RateLimit-Limit", String(keyLimit));
    response.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(keyLimit - keyCount, 0)),
    );
    response.setHeader("X-RateLimit-Reset", String((minute + 1) * 60));
    if (keyCount > keyLimit || orgCount > orgLimit) {
      await this.repo.appendSecurityEvent({
        organizationId: record.organization_id,
        apiKeyId: record.id,
        eventType: "API_RATE_LIMIT_EXCEEDED",
        severity: keyCount > keyLimit * 2 ? "HIGH" : "MEDIUM",
        sourceIp,
        metadata: { keyCount, orgCount },
      });
      response.setHeader("Retry-After", "60");
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Rate limit exceeded." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    request.organizationId = record.organization_id;
    request.apiKey = {
      id: record.id,
      organizationId: record.organization_id,
      environment: record.environment,
      scopes,
      publicId: record.public_id,
    };
    await this.repo.touchKey(record.organization_id, record.id);
    return true;
  }

  private async authenticate(request: PublicApiRequest, sourceIp: string) {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith("Bearer ")) {
      const token = authorization.slice(7).trim();
      const parsed =
        /^wsa_(live|test)_([A-Za-z0-9_-]{12})_([A-Za-z0-9_-]{43})$/.exec(token);
      if (parsed) {
        const record = await this.repo.authenticate(parsed[2], sourceIp);
        if (
          !record ||
          record.environment.toLowerCase() !== parsed[1] ||
          !this.keys.verify(token, record.secret_verifier)
        )
          return { record: null };
        return { record };
      }
      let claims: PublicAccessTokenClaims;
      try {
        claims = await this.tokens.verify(token);
      } catch {
        return { record: null };
      }
      if (claims.type !== "public_api_access") return { record: null };
      const record = await this.repo.authenticate(claims.pid, sourceIp);
      if (
        !record ||
        record.id !== claims.sub ||
        record.organization_id !== claims.org ||
        record.environment !== claims.env
      )
        return { record: null };
      return {
        record,
        scopes: claims.scopes.filter((scope) => record.scopes.includes(scope)),
      };
    }
    if (
      !request.headers["x-relay-key-id"] &&
      !request.headers["x-relay-timestamp"] &&
      !request.headers["x-relay-signature"]
    )
      this.unauthorized("API_KEY_REQUIRED");
    return this.authenticateSignature(request, sourceIp);
  }

  private async authenticateSignature(
    request: PublicApiRequest,
    sourceIp: string,
  ) {
    const publicId = String(request.headers["x-relay-key-id"] ?? "");
    const timestamp = String(request.headers["x-relay-timestamp"] ?? "");
    const supplied = String(request.headers["x-relay-signature"] ?? "");
    if (!/^[A-Za-z0-9_-]{12}$/.test(publicId)) return { record: null };
    const seconds = Number(timestamp);
    if (
      !Number.isInteger(seconds) ||
      Math.abs(Date.now() / 1000 - seconds) > 300
    )
      return { record: null };
    const match = /^v1=([0-9a-f]{64})$/.exec(supplied);
    if (!match) return { record: null };
    const record = await this.repo.authenticate(publicId, sourceIp);
    if (!record) return { record: null };
    const secret = await this.keys.signingSecret(record);
    if (!secret) return { record: null };
    const body = (request as any).rawBody as Buffer | undefined;
    const bodyHash = createHash("sha256")
      .update(body ?? Buffer.alloc(0))
      .digest("hex");
    const canonical = `${timestamp}\n${request.method.toUpperCase()}\n${request.originalUrl}\n${bodyHash}`;
    const expected = createHmac("sha256", secret)
      .update(canonical)
      .digest("hex");
    if (!this.equal(expected, match[1])) return { record: null };
    const fresh = await this.redis.setNX(
      `public-api:hmac:${publicId}:${match[1]}`,
      1,
      300,
    );
    if (!fresh) this.unauthorized("SIGNATURE_REPLAYED");
    return { record };
  }

  private equal(expected: string, actual: string) {
    const left = Buffer.from(expected, "hex");
    const right = Buffer.from(actual, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private requestId(value?: string) {
    return value && isUuid(value) ? value : uuid();
  }

  private sourceIp(value: string) {
    return value.startsWith("::ffff:") ? value.slice(7) : value;
  }

  private unauthorized(code: string): never {
    throw new UnauthorizedException({
      code,
      message: "The API credential is invalid or no longer active.",
    });
  }
}
