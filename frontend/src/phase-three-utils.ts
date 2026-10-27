export function parseObject(
  value: string,
  label = "JSON",
): Record<string, unknown> {
  if (!value.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
    throw new Error(`${label} must be a JSON object.`);
  return parsed as Record<string, unknown>;
}

export function recipientPayload(
  contactIds: string[],
  parameters: Record<string, unknown> = {},
) {
  return [...new Set(contactIds.filter(Boolean))].map((contactId) => ({
    contactId,
    parameters,
  }));
}
