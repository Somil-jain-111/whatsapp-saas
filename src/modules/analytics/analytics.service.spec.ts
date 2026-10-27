import { AnalyticsService } from "./analytics.service";

describe("AnalyticsService", () => {
  const repo = { campaign: jest.fn() };
  const service = new AnalyticsService(repo as never);

  beforeEach(() => jest.clearAllMocks());

  it("returns campaign analytics from the repository", async () => {
    repo.campaign.mockResolvedValue({ id: "campaign-id" });
    await expect(service.campaign("org-id", "campaign-id")).resolves.toEqual({
      id: "campaign-id",
    });
  });

  it("uses the centralized business exception when a campaign is absent", async () => {
    repo.campaign.mockResolvedValue(null);
    await expect(
      service.campaign("org-id", "missing-id"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "ANL_001" }),
      status: 404,
    });
  });
});
