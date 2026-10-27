import { describe, expect, it } from "vitest";
import { formatMoney, parseArray } from "./phase-four-utils";

describe("phase four helpers", () => {
  it("formats minor currency units", () => {
    expect(formatMoney(4900, "USD")).toContain("49.00");
  });

  it("accepts only array-shaped admin configuration", () => {
    expect(parseArray('[{"code":"messages"}]', "Features")).toHaveLength(1);
    expect(() => parseArray("{}", "Features")).toThrow("JSON array");
  });
});
