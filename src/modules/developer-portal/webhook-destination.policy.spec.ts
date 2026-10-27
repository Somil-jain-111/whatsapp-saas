import { BadRequestException } from "@nestjs/common";
import { WebhookDestinationPolicy } from "./webhook-destination.policy";

describe("WebhookDestinationPolicy", () => {
  const policy = new WebhookDestinationPolicy();

  it.each([
    "https://127.0.0.1/hook",
    "https://10.0.0.2/hook",
    "https://169.254.169.254/latest/meta-data",
    "http://8.8.8.8/hook",
  ])("blocks unsafe destination %s", async (url) => {
    await expect(policy.assertPublicHttps(url)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("accepts a literal public HTTPS destination", async () => {
    await expect(
      policy.assertPublicHttps("https://8.8.8.8/hook"),
    ).resolves.toEqual(expect.objectContaining({ url: expect.any(URL) }));
  });
});
