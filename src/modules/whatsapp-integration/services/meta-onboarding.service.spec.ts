import { MetaOnboardingService } from "./meta-onboarding.service";

describe("MetaOnboardingService", () => {
  it("blocks Meta onboarding without the paid entitlement", async () => {
    const service = new MetaOnboardingService(
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      {} as never,
      { canUseFeature: jest.fn().mockResolvedValue(false) } as never,
    );

    await expect(service.start("organization", "user")).rejects.toThrow(
      "A paid subscription is required",
    );
  });

  it("reports that platform onboarding must be configured", async () => {
    const repository = {
      appConfiguration: jest.fn().mockResolvedValue(null),
      createOnboardingSession: jest.fn(),
    };
    const config = {
      get: jest.fn((name: string, fallback: unknown) =>
        name === "META_INTEGRATION_ENABLED" ? false : fallback,
      ),
    };
    const service = new MetaOnboardingService(
      repository as never,
      {} as never,
      {} as never,
      config as never,
      {} as never,
      { canUseFeature: jest.fn().mockResolvedValue(true) } as never,
    );

    await expect(
      service.start(
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ),
    ).resolves.toEqual({
      configurationRequired: true,
      mode: "PLATFORM",
      message: "Platform Meta onboarding is not configured.",
    });
    expect(repository.createOnboardingSession).not.toHaveBeenCalled();
  });

  it("uses the platform Meta app for customer Embedded Signup", async () => {
    const repository = {
      appConfiguration: jest.fn(),
      createOnboardingSession: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((name: string, fallback: unknown) => {
        if (name === "META_INTEGRATION_ENABLED") return true;
        if (name === "META_ONBOARDING_TTL_SECONDS") return 600;
        return fallback;
      }),
    };
    const meta = {
      publicConfiguration: jest.fn().mockReturnValue({
        appId: "123",
        configurationId: "456",
        graphApiVersion: "v23.0",
      }),
    };
    const service = new MetaOnboardingService(
      repository as never,
      meta as never,
      {} as never,
      config as never,
      {} as never,
      { canUseFeature: jest.fn().mockResolvedValue(true) } as never,
    );

    await expect(
      service.start(
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        appId: "123",
        configurationId: "456",
        graphApiVersion: "v23.0",
      }),
    );
    expect(repository.appConfiguration).not.toHaveBeenCalled();
    expect(repository.createOnboardingSession).toHaveBeenCalledTimes(1);
  });
});
