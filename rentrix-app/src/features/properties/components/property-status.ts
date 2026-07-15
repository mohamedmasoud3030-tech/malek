export const propertyStatusTone = { active: 'success', inactive: 'neutral', maintenance: 'warning', sold: 'info' } as const;

const propertyTypeAliases: Readonly<Record<string, string>> = {
  building: 'مبنى',
  Building: 'مبنى',
  BUILDING: 'مبنى',
};

export function translatePropertyType(value: string): string {
  const trimmed = value.trim();
  return propertyTypeAliases[trimmed] ?? trimmed;
}
