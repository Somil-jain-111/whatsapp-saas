import { ConflictException } from "@nestjs/common";
import { CampaignsRepository } from "./campaigns.repository";
import { CAMPAIGN_TRANSITIONS, CampaignsService } from "./campaigns.service";
describe("CampaignsService", () => {
  it("defines only safe campaign transitions", () => {
    expect(CAMPAIGN_TRANSITIONS.resume).toEqual(["PAUSED"]);
    expect(CAMPAIGN_TRANSITIONS.launch).not.toContain("COMPLETED");
  });
  it("rejects launch when validation fails", async () => {
    const repo = {
      validate: jest.fn().mockResolvedValue({ valid: false, errors: ["bad"] }),
    } as unknown as CampaignsRepository;
    await expect(
      new CampaignsService(repo, {} as any, {} as any).transition(
        "o",
        "i",
        "launch",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("restores the campaign when queueing fails", async () => {
    const repo = {
      validate: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
      get: jest.fn().mockResolvedValue({ id: "i", status: "DRAFT" }),
      transition: jest
        .fn()
        .mockResolvedValueOnce({ id: "i", status: "QUEUED" })
        .mockResolvedValueOnce({ id: "i", status: "DRAFT" }),
      schedule: jest.fn().mockResolvedValue(undefined),
      cancelSchedule: jest.fn().mockResolvedValue(undefined),
    } as unknown as CampaignsRepository;
    const messaging = {
      enqueueCampaign: jest.fn().mockRejectedValue(new Error("redis down")),
      removeCampaignJob: jest.fn().mockResolvedValue(undefined),
    };
    const entitlements = {
      reserveQuota: jest.fn().mockResolvedValue({ id: "reservation" }),
      commitQuota: jest.fn(),
      releaseQuota: jest.fn(),
    };
    const service = new CampaignsService(
      repo,
      messaging as any,
      entitlements as any,
    );

    await expect(service.transition("o", "i", "launch")).rejects.toThrow(
      "redis down",
    );
    expect(repo.transition).toHaveBeenLastCalledWith("o", "i", ["QUEUED"], "DRAFT");
    expect(entitlements.releaseQuota).toHaveBeenCalledWith("o", "reservation");
  });
});
