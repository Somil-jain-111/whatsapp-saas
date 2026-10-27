export function normalizeChatbotText(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchesChatbotRule(
  input: string,
  matchType: string,
  keyword: string,
): boolean {
  if (matchType === "EXACT") return input.trim() === keyword.trim();
  const text = normalizeChatbotText(input);
  const expected = normalizeChatbotText(keyword);
  return matchType === "CONTAINS" ? text.includes(expected) : text === expected;
}
