export function formatPropertyUnitSummary(unitCount: number | undefined, occupiedUnits: number | undefined): {
  text: string;
  hasCount: boolean;
} {
  if (unitCount === undefined) {
    return { text: 'تفاصيل الوحدات', hasCount: false };
  }
  if (unitCount === 0) {
    return { text: '0 وحدة', hasCount: true };
  }
  const occupied = occupiedUnits ?? 0;
  return { text: `${occupied}/${unitCount} وحدة`, hasCount: true };
}
