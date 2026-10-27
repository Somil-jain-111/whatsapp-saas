import { ConflictException } from "@nestjs/common";
import { EntitlementService } from "./entitlement.service";

describe("EntitlementService", () => {
  it("rejects a reservation that would exceed the active quota", async () => {
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            enabled: true,
            quota: "10",
            used: "8",
            reserved: "2",
            current_period_start: new Date(),
            current_period_end: new Date(Date.now() + 60_000),
          },
        ]),
    };
    const tenants = {
      run: (_org: string, callback: any) => callback(manager),
    };
    const service = new EntitlementService(tenants as any);
    await expect(
      service.reserveQuota("org", "messages", 1, "request-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns an existing reservation for the same idempotency key", async () => {
    const existing = { id: "reservation", quantity: "2", status: "RESERVED" };
    const manager = {
      query: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([existing]),
    };
    const service = new EntitlementService({
      run: (_org: string, callback: any) => callback(manager),
    } as any);
    await expect(
      service.reserveQuota("org", "messages", 2, "request-1"),
    ).resolves.toEqual(existing);
    expect(manager.query).toHaveBeenCalledTimes(2);
  });
});
