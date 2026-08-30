export const propertyStatusTone = { active: 'success', inactive: 'neutral', maintenance: 'warning', sold: 'info' } as const;

const propertyTypeAliases: Readonly<Record<string, string>> = {
  building: 'مبنى',
  residential: 'سكني',
  commercial: 'تجاري',
  villa: 'فيلا',
  apartment: 'شقة',
  land: 'أرض',
  office: 'مكتبي',
  mixed: 'متعدد الاستخدام',
  warehouse: 'مستودع',
  shop: 'محل',
};

export function translatePropertyType(value: string | null | undefined): string {
  // Defensive: the properties table declares type NOT NULL, but property
  // objects can reach the overview without it (stub/preview/import shapes).
  // An unguarded value.trim() here crashed the whole property detail route
  // with a raw TypeError instead of degrading gracefully.
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '—';
  return propertyTypeAliases[trimmed] ?? propertyTypeAliases[trimmed.toLowerCase()] ?? trimmed;
}
