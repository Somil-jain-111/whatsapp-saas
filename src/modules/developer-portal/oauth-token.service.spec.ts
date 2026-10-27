import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from "@nestjs/common";
import { OAuthTokenService } from "./oauth-token.service";

const rawKey = `wsa_test_abcdefghijkl_${"s".repeat(43)}`;

function setup(overrides: Record<string, unknown> = {}) {
  const record = {
    id: "key-id",
    public_id: "abcdefghijkl",
    organization_id: "org-id",
    environment: "TEST",
    secret_verifier: "verifier",
    status: "ACTIVE",
    expires_at: null,
    organization_status: "ACTIVE",
    api_access_enabled: true,
    subscription_active: true,
    allowlist_count: 0,
    ip_allowed: true,
    mtls_required: false,
    scopes: ["messages:send", "messages:read"],
    ...overrides,
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue("access-token") };
  const keys = {
    verify: jest.fn().mockReturnValue(true),
    hasAuthorizedClientCertificate: jest.fn().mockReturnValue(true),
  };
  const service = new OAuthTokenService(
    jwt as never,
    {
      get: jest.fn((name: string, fallback: unknown) =>
        name === "PUBLIC_API_ACCESS_TOKEN_SECRET" ? "x".repeat(40) : fallback,
      ),
    } as never,
    keys as never,
    { authenticate: jest.fn().mockResolvedValue(record) } as never,
    { incrementWithExpiry: jest.fn().mockResolvedValue(1) } as never,
  );
  const request = {
    ip: "203.0.113.10",
    headers: {
      authorization: `Basic ${Buffer.from(`abcdefghijkl:${rawKey}`).toString("base64")}`,
    },
  };
  return { service, request, jwt, keys };
}

describe("OAuthTokenService", () => {
  it("issues a short-lived token with only requested granted scopes", async () => {
    const { service, request, jwt } = setup();
    await expect(
      service.issue(request as never, {
        grant_type: "client_credentials",
        scope: "messages:read",
      }),
    ).resolves.toEqual({
      access_token: "access-token",
      token_type: "Bearer",
      expires_in: 300,
      scope: "messages:read",
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ scopes: ["messages:read"], org: "org-id" }),
      expect.objectContaining({ algorithm: "HS256", expiresIn: 300 }),
    );
  });

  it("rejects a scope the key does not own", async () => {
    const { service, request } = setup();
    await expect(
      service.issue(request as never, {
        grant_type: "client_credentials",
        scope: "campaigns:manage",
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it("rejects a revoked client and a missing required certificate", async () => {
    const revoked = setup({ status: "REVOKED" });
    await expect(
      revoked.service.issue(revoked.request as never, {
        grant_type: "client_credentials",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const mtls = setup({ mtls_required: true });
    mtls.keys.hasAuthorizedClientCertificate.mockReturnValue(false);
    await expect(
      mtls.service.issue(mtls.request as never, {
        grant_type: "client_credentials",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
