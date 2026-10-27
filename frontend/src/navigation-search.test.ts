import { describe, expect, it } from "vitest";
import { matchesNavigationSearch } from "./navigation-search";

describe("workspace navigation search", () => {
  it("matches page labels and groups without case sensitivity", () => {
    expect(matchesNavigationSearch("campaign", "Campaigns", "Engage")).toBe(
      true,
    );
    expect(matchesNavigationSearch("WHATSAPP", "Templates", "WhatsApp")).toBe(
      true,
    );
    expect(matchesNavigationSearch("invoice", "Campaigns", "Engage")).toBe(
      false,
    );
  });
});
