import { of } from "rxjs";
import { RazorpayProvider } from "./razorpay.provider";

describe("RazorpayProvider", () => {
  it("creates a hosted subscription with tenant-scoped notes", async () => {
    const http = {
      request: jest
        .fn()
        .mockReturnValue(
          of({ data: { id: "sub_1", short_url: "https://rzp.io/i/test" } }),
        ),
    };
    const values: Record<string, unknown> = {
      RAZORPAY_API_BASE_URL: "https://api.razorpay.com",
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "secret_1234567890",
      RAZORPAY_SUBSCRIPTION_TOTAL_COUNT: 120,
    };
    const provider = new RazorpayProvider(
      http as never,
      {
        get: jest.fn(
          (key: string, fallback?: unknown) => values[key] ?? fallback,
        ),
      } as never,
    );

    await expect(
      provider.checkout("org_1", "plan_1", "price_1"),
    ).resolves.toEqual({ id: "sub_1", url: "https://rzp.io/i/test" });
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "post",
        url: "https://api.razorpay.com/v1/subscriptions",
        data: expect.objectContaining({
          plan_id: "plan_1",
          total_count: 120,
          notes: { organization_id: "org_1", price_id: "price_1" },
        }),
      }),
    );
  });
});
