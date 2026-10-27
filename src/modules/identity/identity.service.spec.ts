import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { IdentityService } from "./identity.service";

describe("IdentityService", () => {
  const dataSource = { query: jest.fn() };
  const manager = { query: jest.fn() };
  const tenants = {
    runAsPlatformAdmin: jest.fn(
      (callback: (value: typeof manager) => unknown) => callback(manager),
    ),
  };
  const passwords = { verify: jest.fn(), hash: jest.fn() };
  const jwt = { verifyAsync: jest.fn(), signAsync: jest.fn() };
  const config = {
    getJwtAccessSecret: () => "access-secret-at-least-32-characters",
    getJwtRefreshSecret: () => "refresh-secret-at-least-32-characters",
    get: (_key: string, fallback: unknown) => fallback,
    isLocalOnly: () => true,
  };
  const identityEmail = {
    isConfigured: jest.fn(() => false),
    queueVerification: jest.fn(),
    queuePasswordReset: jest.fn(),
  };
  const encryption = { encrypt: jest.fn(), decrypt: jest.fn() };
  const totp = { secret: jest.fn(), uri: jest.fn(), verify: jest.fn() };
  const service = new IdentityService(
    dataSource as never,
    tenants as never,
    passwords as never,
    jwt as never,
    config as never,
    identityEmail as never,
    encryption as never,
    totp as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.query.mockReset();
    manager.query.mockReset();
    passwords.verify.mockReset();
    passwords.hash.mockReset();
    jwt.verifyAsync.mockReset();
    jwt.signAsync.mockReset();
    identityEmail.isConfigured.mockReset().mockReturnValue(false);
    identityEmail.queueVerification.mockReset();
    identityEmail.queuePasswordReset.mockReset();
  });

  it("does not reveal whether an email exists", async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await expect(
      service.login({
        email: "missing@example.com",
        password: "invalid-password",
        audience: "CUSTOMER",
      }),
    ).rejects.toThrow(new UnauthorizedException("Invalid email or password"));
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it("rejects the administrator audience without an active platform assignment", async () => {
    dataSource.query.mockResolvedValueOnce([
      {
        id: "user-id",
        email_normalized: "user@example.com",
        email_display: "user@example.com",
        full_name: "User",
        password_hash: "hash",
        status: "ACTIVE",
      },
    ]);
    passwords.verify.mockResolvedValueOnce(true);
    manager.query
      .mockResolvedValueOnce([{ id: "organization-id" }])
      .mockResolvedValueOnce([]);

    await expect(
      service.login({
        email: "user@example.com",
        password: "valid-password",
        audience: "PLATFORM_ADMIN",
      }),
    ).rejects.toThrow(
      new ForbiddenException("Platform administrator access required"),
    );
  });

  it("rejects malformed refresh tokens before querying sessions", async () => {
    jwt.verifyAsync.mockRejectedValueOnce(new Error("invalid"));
    await expect(
      service.refresh({ refreshToken: "x".repeat(32) }),
    ).rejects.toThrow(new UnauthorizedException("Invalid refresh token"));
  });

  it("registers an owner workspace atomically and requires email verification", async () => {
    passwords.hash.mockResolvedValueOnce("password-hash");
    manager.query
      .mockResolvedValueOnce([{ id: "owner-role" }])
      .mockResolvedValueOnce([{ id: "new-user" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const result = await service.register({
      fullName: "New Owner",
      email: "OWNER@EXAMPLE.COM",
      password: "Strong!Password1",
      name: "Example Company",
      slug: "example-company",
      countryCode: "IN",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
    });

    expect(passwords.hash).toHaveBeenCalledWith("Strong!Password1");
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO whatsapp_core.organization_members"),
      expect.arrayContaining([expect.any(String), "new-user", "owner-role"]),
    );
    expect(identityEmail.queueVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@example.com" }),
    );
    expect(manager.query).not.toHaveBeenCalledWith(
      expect.stringContaining("SET CONSTRAINTS"),
    );
    expect(result).toEqual(
      expect.objectContaining({
        email: "owner@example.com",
        requiresEmailVerification: true,
        verificationToken: expect.any(String),
      }),
    );
  });

  it("rejects an invalid email-verification token without creating a session", async () => {
    manager.query.mockResolvedValueOnce([]);
    await expect(
      service.verifyEmail({
        token: "x".repeat(32),
        password: "Strong!Password1",
      }),
    ).rejects.toThrow(
      new UnauthorizedException("Invalid or expired verification link"),
    );
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("does not activate a pending account when the password is wrong", async () => {
    manager.query.mockResolvedValueOnce([
      {
        id: "verification-id",
        user_id: "user-id",
        email_normalized: "user@example.com",
        email_display: "user@example.com",
        full_name: "User",
        password_hash: "stored-hash",
        status: "PENDING_VERIFICATION",
      },
    ]);
    passwords.verify.mockResolvedValueOnce(false);

    await expect(
      service.verifyEmail({
        token: "x".repeat(32),
        password: "Wrong!Password1",
      }),
    ).rejects.toThrow(
      new UnauthorizedException("Invalid verification credentials"),
    );
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid invitation before creating a member", async () => {
    passwords.hash.mockResolvedValueOnce("password-hash");
    manager.query.mockResolvedValueOnce([]);
    await expect(
      service.acceptInvitation({
        token: "x".repeat(32),
        fullName: "Invitee",
        password: "Strong!Password1",
      }),
    ).rejects.toThrow(
      new UnauthorizedException("Invalid or expired invitation"),
    );
  });

  it("does not reveal whether a password-reset email exists", async () => {
    manager.query.mockResolvedValueOnce([]);

    await expect(
      service.forgotPassword({ email: "missing@example.com" }),
    ).resolves.toEqual({
      message:
        "If an active account exists, a password reset link has been issued.",
    });
    expect(identityEmail.queuePasswordReset).not.toHaveBeenCalled();
  });

  it("resets a password atomically and revokes active sessions", async () => {
    passwords.hash.mockResolvedValueOnce("new-password-hash");
    manager.query
      .mockResolvedValueOnce([{ id: "reset-id", user_id: "user-id" }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(
      service.resetPassword({
        token: "x".repeat(32),
        password: "New!Password1",
      }),
    ).resolves.toEqual({
      message: "Password updated. Sign in with your new password.",
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE whatsapp_core.sessions"),
      ["user-id"],
    );
  });
});
