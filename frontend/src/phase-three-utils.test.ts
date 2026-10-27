import { describe, expect, it } from "vitest";
import { parseObject, recipientPayload } from "./phase-three-utils";

describe("phase three payload helpers", () => {
  it("validates object-shaped JSON", () => {
    expect(parseObject('{"1":"Asha"}')).toEqual({ 1: "Asha" });
    expect(() => parseObject("[]")).toThrow("JSON object");
    expect(() => parseObject("{")).toThrow("valid JSON");
  });

  it("deduplicates campaign recipients", () => {
    expect(recipientPayload(["a", "a", "b"])).toEqual([
      { contactId: "a", parameters: {} },
      { contactId: "b", parameters: {} },
    ]);
  });
});
