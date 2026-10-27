import { matchesChatbotRule } from "./chatbot.matcher";

describe("matchesChatbotRule", () => {
  it("keeps exact matching case-sensitive", () => {
    expect(matchesChatbotRule("Hi", "EXACT", "hi")).toBe(false);
    expect(matchesChatbotRule("Hi", "EXACT", "Hi")).toBe(true);
  });

  it("normalizes case and whitespace", () => {
    expect(
      matchesChatbotRule("  HELLO   there ", "NORMALIZED", "hello there"),
    ).toBe(true);
    expect(matchesChatbotRule("Please HELP me", "CONTAINS", "help")).toBe(true);
  });
});
