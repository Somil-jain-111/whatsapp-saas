import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { createHash, createHmac } from "crypto";
import { PublicApiGuard } from "./public-api.guard";

const secret = "test-api-key-hash-secret-at-least-32-characters";
const rawKey = `wsa_test_abcdefghijkl_${"s".repeat(43)}`;

function setup(
  overrides: Record<string, unknown> = {},
  required = "messages:send",
) {
  const record = {
    id: "key-id",
    organization_id: "org-id",
    public_id: "abcdefghijkl",
    secret_verifier: createHmac("sha256", secret).update(rawKey).digest("hex"),
    environment: "TEST",
    status: "ACTIVE",
    expires_at: null,
    organization_status: "ACTIVE",
    api_access_enabled: true,
    subscription_active: true,
    allowlist_count: 0,
    ip_allowed: false,
    scopes: ["messages:send"],
    ...overrides,
  };
  const repo = {
    authenticate: jest.fn().mockResolvedValue(record),
    touchKey: jest.fn().mockResolvedValue(undefined),
    appendSecurityEvent: jest.fn().mockResolvedValue(undefined),
  };
  const response = { setHeader: jest.fn() };
  const request: any = {
    headers: { authorization: `Bearer ${rawKey}` },
    header: jest.fn(),
    ip: "203.0.113.10",
    method: "POST",
    originalUrl: "/public/v1/messages/template",
    rawBody: Buffer.from("{}"),
  };
  const context: any = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  };
  const tokens = { verify: jest.fn().mockRejectedValue(new Error("invalid")) };
  const keyService = {
    verify: (value: string, verifier: string) =>
      createHmac("sha256", secret).update(value).digest("hex") === verifier,
    signingSecret: jest.fn().mockResolvedValue("wss_test-signing-secret"),
    hasAuthorizedClientCertificate: jest.fn().mockReturnValue(true),
  };
  const redis = {
    incrementWithExpiry: jest.fn().mockResolvedValue(1),
    setNX: jest.fn().mockResolvedValue(true),
  };
  const guard = new PublicApiGuard(
    { getAllAndOverride: jest.fn().mockReturnValue(required) } as never,
    keyService as never,
    repo as never,
    redis as never,
    {
      isProduction: jest.fn().mockReturnValue(false),
      get: jest.fn((_name: string, fallback: unknown) => fallback),
    } as never,
    tokens as never,
  );
  return { guard, context, request, repo, tokens, redis, keyService };
}

describe("PublicApiGuard", () => {
  it("authenticates a valid scoped credential and derives the tenant from the key", async () => {
    const { guard, context, request } = setup();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationId).toBe("org-id");
  });

  it("rejects an invalid credential", async () => {
    const { guard, context, repo } = setup();
    repo.authenticate.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    ["expired", { expires_at: new Date(Date.now() - 1000) }],
    ["revoked", { status: "REVOKED" }],
  ])("rejects a %s credential", async (_name, overrides) => {
    const { guard, context } = setup(overrides);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a missing scope", async () => {
    const { guard, context } = setup({ scopes: ["messages:read"] });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("does not trust a tenant supplied by the caller", async () => {
    const { guard, context, request } = setup();
    request.organizationId = "attacker-org";
    await guard.canActivate(context);
    expect(request.organizationId).toBe("org-id");
  });

  it("accepts a short-lived access token but intersects its scopes with the key", async () => {
    const { guard, context, request, tokens } = setup({}, "messages:read");
    request.headers.authorization = "Bearer signed.jwt.token";
    tokens.verify.mockResolvedValue({
      sub: "key-id",
      pid: "abcdefghijkl",
      org: "org-id",
      env: "TEST",
      scopes: ["messages:read"],
      type: "public_api_access",
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("accepts a fresh HMAC signature and rejects its replay", async () => {
    const { guard, context, request, redis } = setup();
    delete request.headers.authorization;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const bodyHash = createHash("sha256").update(request.rawBody).digest("hex");
    const canonical = `${timestamp}\nPOST\n${request.originalUrl}\n${bodyHash}`;
    const signature = createHmac("sha256", "wss_test-signing-secret")
      .update(canonical)
      .digest("hex");
    request.headers["x-relay-key-id"] = "abcdefghijkl";
    request.headers["x-relay-timestamp"] = timestamp;
    request.headers["x-relay-signature"] = `v1=${signature}`;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    redis.setNX.mockResolvedValue(false);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
