/**
 * EnterpriseFilters — Enterprise UX Foundation (Wave 4A)
 *
 * Config-driven filter strip: renders select/text/date controls from a
 * declarative field list, tracks active chips, and offers clear-all.
 * Pairs directly with `useFilters`:
 *
 * @example
 * const filters = useFilters({ status: '', owner: '' });
 * <EnterpriseFilters
 *   fields={[
 *     { id: 'status', label: 'الحالة', type: 'select', options: statusOptions },
 *     { id: 'owner', label: 'المالك', type: 'text' },
 *   ]}
 *   values={filters.values}
 *   onChange={filters.setValue}
 *   onClearAll={filters.clearAll}
 * />
 *
 * No business logic: options/labels/values come from the module.
 */

import { FilterX, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface EnterpriseFilterOption {
  value: string;
  label: string;
}

export interface EnterpriseFilterField {
  id: string;
  label: string;
  type: 'select' | 'text' | 'date';
  /** `select` only — include an empty option automatically. */
  options?: EnterpriseFilterOption[];
  /** Option label to show for the empty value (selects). Default "الكل". */
  allLabel?: string;
  placeholder?: string;
  /** Pill width hint for the control. */
  widthClassName?: string;
  disabled?: boolean;
}

export interface EnterpriseFiltersProps<TValues extends Record<string, string>> {
  fields: EnterpriseFilterField[];
  values: TValues;
  onChange: (fieldId: string, value: string) => void;
  /** Render active filter chips with remove buttons. Default true. */
  showActiveChips?: boolean;
  onClearAll?: () => void;
  /** Hide the whole strip when no field exists. Default collapses to null. */
  className?: string;
  /** Label for the clear-all action. */
  clearAllLabel?: string;
}

const controlWidth = 'w-full sm:w-40';

function resolveChipLabel(
  field: EnterpriseFilterField,
  value: string,
): string {
  if (field.type === 'select') {
    const option = field.options?.find((candidate) => candidate.value === value);
    return option ? `${field.label}: ${option.label}` : `${field.label}: ${value}`;
  }
  return `${field.label}: ${value}`;
}

export function EnterpriseFilters<TValues extends Record<string, string>>({
  fields,
  values,
  onChange,
  showActiveChips = true,
  onClearAll,
  className,
  clearAllLabel = 'مسح الفلاتر',
}: EnterpriseFiltersProps<TValues>) {
  if (fields.length === 0) return null;

  const activeFields = fields.filter((field) => (values[field.id] ?? '').trim() !== '');

  return (
    <div data-enterprise-filters className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {fields.map((field) => {
          const value = values[field.id] ?? '';
          const common = {
            'aria-label': field.label,
            disabled: field.disabled,
          } as const;

          if (field.type === 'select') {
            return (
              <Select
                key={field.id}
                {...common}
                value={value}
                onChange={(event) => onChange(field.id, event.target.value)}
                className={cn(
                  'min-h-10 sm:min-h-10 rounded-xl bg-card',
                  controlWidth,
                  field.widthClassName,
                )}
              >
                <option value="">{field.allLabel ?? `الكل — ${field.label}`}</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            );
          }

          return (
            <input
              key={field.id}
              {...common}
              type={field.type === 'date' ? 'date' : 'text'}
              value={value}
              placeholder={field.placeholder ?? field.label}
              onChange={(event) => onChange(field.id, event.target.value)}
              className={cn(
                'h-10 rounded-xl border border-input bg-card px-3 text-sm outline-none transition',
                'focus:border-primary focus:ring-4 focus:ring-primary/10',
                'disabled:cursor-not-allowed disabled:opacity-50',
                controlWidth,
                field.widthClassName,
              )}
            />
          );
        })}

        {onClearAll && activeFields.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-muted-foreground"
            aria-label={clearAllLabel}
          >
            <FilterX className="me-1 size-4" aria-hidden="true" />
            {clearAllLabel}
          </Button>
        ) : null}
      </div>

      {showActiveChips && activeFields.length > 0 ? (
        <div
          data-enterprise-filter-chips
          className="flex flex-wrap items-center gap-1.5"
          role="list"
          aria-label="الفلاتر النشطة"
        >
          {activeFields.map((field) => (
            <span key={field.id} role="listitem">
              <Badge variant="primary" className="gap-1 pe-1">
                {resolveChipLabel(field, values[field.id] ?? '')}
                <button
                  type="button"
                  onClick={() => onChange(field.id, '')}
                  aria-label={`إزالة فلتر ${field.label}`}
                  className="grid size-4 place-items-center rounded-full transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </Badge>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
