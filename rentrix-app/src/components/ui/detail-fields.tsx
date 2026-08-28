import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DetailField {
  label: string;
  /** Pass formatted, ready-to-display content — formatting stays in the feature. */
  value: ReactNode;
  /** Span 2 grid columns from tablet width upward — use for notes/long text. */
  wide?: boolean;
}

/**
 * Shared label/value grid for entity detail pages (contracts, properties,
 * owners, receipts…). Replaces the local `Info`/field-card components that
 * were duplicated per page. Empty values render as "—" automatically.
 *
 * MALEK layout contract:
 * - details are flat rows, never a pile of mini-cards inside another surface;
 * - phones use one readable column, then two columns from `sm` upward;
 * - three columns are allowed only when a caller explicitly asks for them;
 * - legacy `columns={4}` is retained for compatibility but renders as two.
 */
export function DetailFields({ fields, columns = 2, className }: { fields: DetailField[]; columns?: 2 | 3 | 4; className?: string }) {
  const useThreeColumns = columns === 3;
  return (
    <div
      data-detail-fields
      data-detail-columns={useThreeColumns ? '3' : '2'}
      className={cn(
        'grid grid-cols-1 gap-x-5 sm:grid-cols-2',
        useThreeColumns ? 'lg:grid-cols-3' : 'sm:[&>*:last-child:nth-child(odd)]:col-span-2',
        className,
      )}
    >
      {fields.map((field) => (
        <div
          key={field.label}
          className={cn(
            'min-w-0 overflow-hidden border-b border-border/60 py-3',
            field.wide && 'sm:col-span-2',
          )}
        >
          <p className="text-xs font-bold leading-5 text-muted-foreground">{field.label}</p>
          <div className="mt-1 min-w-0 break-words text-sm font-bold leading-6 [overflow-wrap:anywhere]">
            {field.value === null || field.value === undefined || field.value === '' ? '—' : field.value}
          </div>
        </div>
      ))}
    </div>
  );
}
