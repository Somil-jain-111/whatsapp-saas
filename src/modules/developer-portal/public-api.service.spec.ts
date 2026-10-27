import { HttpException } from "@nestjs/common";
import { PublicApiService } from "./public-api.service";

const principal = {
  id: "key-id",
  organizationId: "org-id",
  environment: "LIVE" as const,
  scopes: ["messages:send" as const],
  publicId: "abcdefghijkl",
};
const message = {
  to: "+919876543210",
  sender_id: "00000000-0000-4000-8000-000000000001",
  template_id: "00000000-0000-4000-8000-000000000002",
  language: "en_US",
  parameters: {},
  scenario: "delivered",
};

function setup(reservation: Record<string, unknown>, send: jest.Mock) {
  const repo = {
    reserveMessageSpend: jest.fn().mockResolvedValue(reservation),
    finishSpendReservation: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PublicApiService(
    repo as never,
    { send } as never,
    {} as never,
    {} as never,
    {} as never,
    { incrementWithExpiry: jest.fn().mockResolvedValue(1) } as never,
    { get: jest.fn((_name: string, fallback: unknown) => fallback) } as never,
  );
  return { service, repo };
}

describe("PublicApiService spending cap", () => {
  it("rejects an invalid idempotency key with a business error", async () => {
    const { service } = setup({}, jest.fn());
    await expect(
      service.sendTemplate(principal, message, "invalid key"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "IDEMPOTENCY_KEY_REQUIRED",
      }),
      status: 400,
    });
  });

  it("rejects before dispatch when the monthly cap is reached", async () => {
    const send = jest.fn();
    const { service } = setup({ exceeded: true, reservation: null }, send);
    await expect(
      (service as any).sendLive(principal, message, "order-1"),
    ).rejects.toBeInstanceOf(HttpException);
    expect(send).not.toHaveBeenCalled();
  });

  it("commits a reservation after queueing and releases it on failure", async () => {
    const success = setup(
      { reservation: { id: "reservation-id", status: "RESERVED" } },
      jest.fn().mockResolvedValue({ id: "message-id", status: "QUEUED" }),
    );
    await (success.service as any).sendLive(principal, message, "order-2");
    expect(success.repo.finishSpendReservation).toHaveBeenCalledWith(
      "org-id",
      "reservation-id",
      true,
    );

    const failed = setup(
      { reservation: { id: "reservation-id", status: "RESERVED" } },
      jest.fn().mockRejectedValue(new Error("queue unavailable")),
    );
    await expect(
      (failed.service as any).sendLive(principal, message, "order-3"),
    ).rejects.toThrow("queue unavailable");
    expect(failed.repo.finishSpendReservation).toHaveBeenCalledWith(
      "org-id",
      "reservation-id",
      false,
    );
  });
});
