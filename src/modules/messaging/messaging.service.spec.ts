import { MessagingService } from "./messaging.service";

describe("MessagingService", () => {
  it("keeps committed quota when Redis is temporarily unavailable", async () => {
    const repo = { create: jest.fn().mockResolvedValue({ id: "message-1" }) };
    const queue = { add: jest.fn().mockRejectedValue(new Error("redis down")) };
    const entitlements = {
      reserveQuota: jest.fn().mockResolvedValue({ id: "reservation-1" }),
      commitQuota: jest.fn().mockResolvedValue(undefined),
      releaseQuota: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MessagingService(
      repo as any,
      queue as any,
      {} as any,
      {} as any,
      entitlements as any,
      { emit: jest.fn() } as any,
      {} as any,
    );

    await expect(service.send("org-1", {} as any)).resolves.toEqual({
      id: "message-1",
    });
    expect(entitlements.commitQuota).toHaveBeenCalledWith(
      "org-1",
      "reservation-1",
    );
    expect(entitlements.releaseQuota).not.toHaveBeenCalled();
  });
});
