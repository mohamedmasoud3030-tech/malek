export function scopeOwnerRows<T extends { owner_id: string }>(
  rows: readonly T[],
  ownerId?: string,
): T[] {
  const scopedOwnerId = ownerId?.trim();
  if (!scopedOwnerId) return [...rows];
  return rows.filter((row) => row.owner_id === scopedOwnerId);
}
