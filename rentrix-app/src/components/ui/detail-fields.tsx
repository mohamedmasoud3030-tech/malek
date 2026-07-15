import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DetailField {
  label: string;
  /** Pass formatted, ready-to-display content — formatting stays in the feature. */
  value: ReactNode;
  /** Span 2 grid columns on md+ — use for notes/long text. */
  wide?: boolean;
}

/**
 * Shared label/value grid for entity detail pages (contracts, properties,
 * owners, receipts…). Replaces the local `Info`/field-card components that
 * were duplicated per page. Empty values render as "—" automatically.
 *
 * @example
 * <DetailFields
 *   columns={4}
 *   fields={[
 *     { label: 'المستأجر', value: contract.people?.full_name },
 *     { label: 'ملاحظات', value: contract.notes, wide: true },
 *   ]}
 * />
 */
export function DetailFields({ fields, columns = 4, className }: { fields: DetailField[]; columns?: 2 | 3 | 4; className?: string }) {
  const colsClass = columns === 2 ? 'md:grid-cols-2' : columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-4';
  return (
    <div className={cn('grid gap-4', colsClass, className)}>
      {fields.map((field) => (
        <div key={field.label} className={cn('rounded-2xl border border-border bg-background p-4', field.wide && 'md:col-span-2')}>
          <p className="text-xs font-bold text-muted-foreground">{field.label}</p>
          <div className="mt-1 font-semibold">{field.value === null || field.value === undefined || field.value === '' ? '—' : field.value}</div>
        </div>
      ))}
    </div>
  );
}
