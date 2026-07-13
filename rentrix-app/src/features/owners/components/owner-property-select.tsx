import { Select } from '@/components/ui/select';

const OWNER_PROPERTY_SELECT_PLACEHOLDER = 'اختر العقار';

type OwnerPropertySelectProps = Readonly<{
  value: string;
  disabled: boolean;
  properties: Array<{ id: string; title: string }>;
  onValueChange: (propertyId: string) => void;
}>;

// components/ui/select.tsx exports Select only: no SelectTrigger, SelectValue, SelectContent, or SelectItem API exists yet.
// Therefore this wrapper intentionally adapts the current native select primitive to an owner-scoped onValueChange API.
export function OwnerPropertySelect({ value, disabled, properties, onValueChange }: OwnerPropertySelectProps) {
  return (
    <Select value={value} onChange={(event) => onValueChange(event.currentTarget.value)} disabled={disabled}>
      <option value="">{OWNER_PROPERTY_SELECT_PLACEHOLDER}</option>
      {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
    </Select>
  );
}
