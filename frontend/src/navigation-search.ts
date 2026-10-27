export function matchesNavigationSearch(query: string, ...values: string[]) {
  const normalized = query.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    values.some((value) => value.toLowerCase().includes(normalized))
  );
}
