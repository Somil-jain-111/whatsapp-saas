import { describe, expect, it } from "vitest";
import { apiCatalog } from "./api-catalog";

describe("API catalog", () => {
  it("exposes every browser-callable phase 2-4 and admin operation once", () => {
    const keys = apiCatalog.map(({ method, path }) => `${method} ${path}`);
    expect(apiCatalog).toHaveLength(208);
    expect(new Set(keys)).toHaveLength(keys.length);
  });

  it("never exposes provider webhook endpoints to browser users", () => {
    expect(apiCatalog.some(({ path }) => path.includes("/webhooks/"))).toBe(
      false,
    );
  });
});
