import { BadRequestException, ConflictException } from "@nestjs/common";
import { EnterpriseService } from "./enterprise.service";

describe("EnterpriseService security policy", () => {
  const repo = {
    membersWithoutMfa: jest.fn(),
    updatePolicy: jest.fn(),
  };
  const service = new EnterpriseService(
    repo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("prevents disabling the only working login method", async () => {
    await expect(
      service.updatePolicy("org", "user", {
        passwordLoginEnabled: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updatePolicy).not.toHaveBeenCalled();
  });

  it("does not require MFA until every active member is enrolled", async () => {
    repo.membersWithoutMfa.mockResolvedValue(1);
    await expect(
      service.updatePolicy("org", "user", { requireMfa: true }),
    ).rejects.toThrow(ConflictException);
    expect(repo.updatePolicy).not.toHaveBeenCalled();
  });

  it("does not advertise an OIDC connection as enabled before sign-in exists", async () => {
    await expect(
      service.createSso("org", "user", {
        name: "Corporate",
        issuerUrl: "https://id.example.com",
        clientId: "client",
        clientSecret: "secret-value",
        redirectUri: "https://app.example.com/sso/callback",
        allowedDomains: ["example.com"],
        enabled: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
