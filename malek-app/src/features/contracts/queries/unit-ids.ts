export function normalizeUnitIds(unitIds: readonly string[]): string[] {
  return [...new Set(unitIds.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}
