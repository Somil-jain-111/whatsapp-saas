export function formatMoney(amountMinor: unknown, currency: unknown) {
  const amount = Number(amountMinor ?? 0);
  const code = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(Number.isFinite(amount) ? amount / 100 : 0);
  } catch {
    return `${code} ${((Number.isFinite(amount) ? amount : 0) / 100).toFixed(2)}`;
  }
}

export function parseArray(value: string, label: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`);
  return parsed;
}
