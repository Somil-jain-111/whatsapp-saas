import { describe, expect, it } from "vitest";
import {
  formatNumber,
  isPlatformAdmin,
  listOf,
  number,
  text,
} from "./api";

describe("API response helpers", () => {
  it("normalizes direct and paginated list responses", () => {
    expect(listOf([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(listOf({ items: [{ id: 2 }], total: 1 })).toEqual([{ id: 2 }]);
    expect(listOf(null)).toEqual([]);
  });

  it("formats uncertain provider values safely", () => {
    expect(number("12")).toBe(12);
    expect(number("invalid")).toBe(0);
    expect(text(null)).toBe("—");
    expect(formatNumber(1200)).toMatch(/1[,.]200/);
  });

  it("allows platform-only pages only for platform admin sessions", () => {
    expect(isPlatformAdmin(null)).toBe(false);
    expect(
      isPlatformAdmin({
        apiUrl: "/api/v1",
        accessToken: "token",
        organizationId: "organization",
        mode: "CUSTOMER",
      }),
    ).toBe(false);
    expect(
      isPlatformAdmin({
        apiUrl: "/api/v1",
        accessToken: "token",
        organizationId: "organization",
        mode: "PLATFORM_ADMIN",
      }),
    ).toBe(true);
  });
});
