import { ForbiddenException } from "@nestjs/common";
import { createHmac } from "crypto";
import { BillingService } from "./billing.service";

describe("BillingService webhook", () => {
  const secret = "whsec_test_secret_123456789";
  const razorpaySecret = "razorpay_webhook_secret_123456";
  function subject() {
    const repo = {
      storeWebhook: jest.fn().mockResolvedValue(true),
      applyStripeEvent: jest.fn().mockResolvedValue(undefined),
      applyRazorpayEvent: jest.fn().mockResolvedValue(undefined),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === "STRIPE_WEBHOOK_SECRET"
          ? secret
          : key === "RAZORPAY_WEBHOOK_SECRET"
            ? razorpaySecret
            : undefined,
      ),
    };
    return {
      repo,
      service: new BillingService(
        repo as never,
        {} as never,
        {} as never,
        config as never,
        {} as never,
      ),
    };
  }
  it("verifies Stripe signatures and removes unrelated payload fields", async () => {
    const { repo, service } = subject();
    const timestamp = Math.floor(Date.now() / 1000);
    const raw = Buffer.from(
      JSON.stringify({
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_1",
            customer: "cus_1",
            subscription: "sub_1",
            client_reference_id: "00000000-0000-4000-8000-000000000001",
            metadata: {
              price_id: "00000000-0000-4000-8000-000000000002",
              secret: "remove-me",
            },
            customer_details: { email: "private@example.com" },
          },
        },
      }),
    );
    const sig = createHmac("sha256", secret)
      .update(`${timestamp}.${raw}`)
      .digest("hex");
    await expect(
      service.stripeWebhook(raw, `t=${timestamp},v1=${sig}`),
    ).resolves.toEqual({ received: true });
    const stored = JSON.stringify(repo.storeWebhook.mock.calls[0][3]);
    expect(stored).not.toContain("private@example.com");
    expect(stored).not.toContain("remove-me");
    expect(repo.applyStripeEvent).toHaveBeenCalledTimes(1);
  });
  it("rejects forged signatures", async () => {
    const { service } = subject();
    await expect(
      service.stripeWebhook(
        Buffer.from("{}"),
        `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it("verifies and deduplicates Razorpay webhooks", async () => {
    const { repo, service } = subject();
    const raw = Buffer.from(
      JSON.stringify({
        event: "subscription.activated",
        payload: {
          subscription: {
            entity: {
              id: "sub_1",
              status: "active",
              customer_id: "cust_1",
              notes: {
                organization_id: "00000000-0000-4000-8000-000000000001",
                price_id: "00000000-0000-4000-8000-000000000052",
                private: "remove-me",
              },
              customer_email: "private@example.com",
            },
          },
        },
      }),
    );
    const signature = createHmac("sha256", razorpaySecret)
      .update(raw)
      .digest("hex");
    await expect(
      service.razorpayWebhook(raw, signature, "event_1"),
    ).resolves.toEqual({ received: true });
    const stored = JSON.stringify(repo.storeWebhook.mock.calls[0][3]);
    expect(stored).not.toContain("private@example.com");
    expect(stored).not.toContain("remove-me");
    expect(repo.applyRazorpayEvent).toHaveBeenCalledWith(
      "event_1",
      "subscription.activated",
      expect.any(Object),
    );
  });
});
