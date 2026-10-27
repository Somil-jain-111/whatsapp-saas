import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { randomUUID } from "crypto";
import { AppConfigService } from "../../default/config/config.service";
import { RedisService } from "../../default/databases/redis/redis.service";
import { ApiKeyService } from "./api-key.service";
import { DeveloperPortalRepository } from "./developer-portal.repository";
import {
  API_SCOPES,
  ApiScope,
  OAuthTokenDto,
} from "./dto/developer-portal.dto";

export interface PublicAccessTokenClaims {
  sub: string;
  pid: string;
  org: string;
  env: "LIVE" | "TEST";
  scopes: ApiScope[];
  type: "public_api_access";
}

@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly keys: ApiKeyService,
    private readonly repo: DeveloperPortalRepository,
    private readonly redis: RedisService,
  ) {}

  async issue(request: Request, dto: OAuthTokenDto) {
    const sourceIp = this.sourceIp(request.ip);
    const { clientId, secret } = this.basic(request.headers.authorization);
    const attempts = await this.redis.incrementWithExpiry(
      `public-oauth:${sourceIp}:${clientId}`,
      65,
    );
    if (attempts > 20)
      throw new HttpException(
        {
          error: "temporarily_unavailable",
          error_description: "Too many token requests.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const record = await this.repo.authenticate(clientId, sourceIp);
    if (
      !record ||
      !this.keys.verify(secret, record.secret_verifier) ||
      record.public_id !== clientId ||
      record.status !== "ACTIVE" ||
      (record.expires_at && new Date(record.expires_at) <= new Date())
    )
      this.invalidClient();
    if (record.organization_status !== "ACTIVE" || !record.api_access_enabled)
      throw new ForbiddenException(
        "API access is disabled for this organization",
      );
    if (!record.subscription_active)
      throw new HttpException(
        "An active plan is required",
        HttpStatus.PAYMENT_REQUIRED,
      );
    if (record.allowlist_count > 0 && !record.ip_allowed)
      throw new ForbiddenException("Source IP is not allowed");
    if (!this.keys.hasAuthorizedClientCertificate(record, request))
      throw new ForbiddenException("A trusted client certificate is required");

    const requested = dto.scope?.trim()
      ? dto.scope.trim().split(/\s+/)
      : record.scopes;
    if (
      requested.some(
        (scope) =>
          !API_SCOPES.includes(scope as ApiScope) ||
          !record.scopes.includes(scope),
      )
    )
      throw new HttpException(
        {
          error: "invalid_scope",
          error_description: "Requested scope is not granted.",
        },
        HttpStatus.BAD_REQUEST,
      );
    const expiresIn = this.config.get<number>(
      "PUBLIC_API_ACCESS_TOKEN_TTL_SECONDS",
      300,
    );
    const claims: PublicAccessTokenClaims = {
      sub: record.id,
      pid: record.public_id,
      org: record.organization_id,
      env: record.environment,
      scopes: requested,
      type: "public_api_access",
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.secret(),
      algorithm: "HS256",
      audience: "relay-public-api",
      issuer: "relay",
      expiresIn,
      jwtid: randomUUID(),
    });
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: requested.join(" "),
    };
  }

  verify(token: string) {
    return this.jwt.verifyAsync<PublicAccessTokenClaims>(token, {
      secret: this.secret(),
      algorithms: ["HS256"],
      audience: "relay-public-api",
      issuer: "relay",
    });
  }

  private secret() {
    return this.config.get<string>("PUBLIC_API_ACCESS_TOKEN_SECRET", "");
  }

  private basic(value?: string) {
    if (!value?.startsWith("Basic ")) this.invalidClient();
    let decoded = "";
    try {
      decoded = Buffer.from(value!.slice(6), "base64").toString("utf8");
    } catch {
      this.invalidClient();
    }
    const separator = decoded.indexOf(":");
    if (separator < 1) this.invalidClient();
    return {
      clientId: decoded.slice(0, separator),
      secret: decoded.slice(separator + 1),
    };
  }

  private sourceIp(value: string) {
    return value.startsWith("::ffff:") ? value.slice(7) : value;
  }

  private invalidClient(): never {
    throw new UnauthorizedException({
      error: "invalid_client",
      error_description: "Client authentication failed.",
    });
  }
}
