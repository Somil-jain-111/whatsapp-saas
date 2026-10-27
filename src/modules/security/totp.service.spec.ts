import { TotpService } from "./totp.service";

describe("TotpService", () => {
  const service = new TotpService();

  it("matches the RFC 6238 SHA-1 vector truncated to six digits", () => {
    expect(service.code("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).toBe(
      "287082",
    );
    expect(
      service.verify("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "287082", 59_000),
    ).toBe(true);
  });

  it("rejects malformed codes", () => {
    expect(service.verify(service.secret(), "12345x")).toBe(false);
  });
});
