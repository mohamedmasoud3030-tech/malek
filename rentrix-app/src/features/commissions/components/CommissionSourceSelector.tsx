import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/select';
import { fetchCommissionSources } from '../services/commission-source-service';

const typeLabels: Record<string, string> = {
  contract: 'عقد',
  payment: 'تحصيل',
  owner: 'مالك',
  lead: 'عميل محتمل',
  land: 'أرض',
};

interface CommissionSourceSelectorProps {
  readonly type: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

/**
 * UX-049: Replaces free-text source_id entry with a typed, permission-aware
 * source selector. Only displays valid entity types supported by the domain.
 * Uses readable Arabic labels and never exposes raw UUIDs as primary labels.
 * Internal value remains the entity UUID for submission through the existing
 * protected RPC path.
 */
export function CommissionSourceSelector({
  type,
  value,
  onChange,
  disabled = false,
}: CommissionSourceSelectorProps) {
  const sourceQuery = useQuery({
    queryKey: ['commission-source-selector', type],
    queryFn: () => fetchCommissionSources(type),
    enabled: type !== 'payment',
    staleTime: 30_000,
  });

  const sources = sourceQuery.data ?? [];
  const isLoading = sourceQuery.isLoading;
  const hasError = sourceQuery.isError;

  if (type === 'payment') {
    return (
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label="المصدر (تحصيل)"
      >
        <option value="">اختر التحصيل المرتبط</option>
        {value && <option value={value}>تحصيل #{value.slice(0, 8)}</option>}
      </Select>
    );
  }

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled || isLoading}
      aria-label={`المصدر (${typeLabels[type] ?? type})`}
    >
      <option value="">
        {isLoading
          ? 'جارٍ تحميل المصادر...'
          : hasError
            ? 'تعذر تحميل المصادر'
            : `اختر ${typeLabels[type] ?? 'المصدر'}`}
      </option>
      {sources.map((source) => (
        <option key={source.id} value={source.id}>
          {source.label}
        </option>
      ))}
    </Select>
  );
}

export { typeLabels };
