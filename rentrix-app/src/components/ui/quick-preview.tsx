import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Compact label/value facts for Quick Preview bodies.
 *
 * Glance-first: 3–8 high-value rows, no nested cards, no page-like chrome.
 * Wide rows span the full preview width; everything else flows into two
 * columns from `sm` up and stays single-column on phones.
 */
export type PreviewFactRow = Readonly<{
  label: string;
  value: ReactNode;
  wide?: boolean;
}>;

export function PreviewFacts({
  rows,
  className,
}: Readonly<{
  rows: readonly PreviewFactRow[];
  className?: string;
}>) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-5 gap-y-0 sm:grid-cols-2', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'min-w-0 border-b border-border/50 py-2.5 last:border-b-0',
            row.wide ? 'sm:col-span-2' : undefined,
          )}
        >
          <dt className="text-[11px] font-medium text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-semibold [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
