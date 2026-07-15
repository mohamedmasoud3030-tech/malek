import { cn } from '@/lib/utils';

interface InlineStatCardProps {
  label: string;
  value: string | number;
  className?: string;
}

/**
 * Compact stat card used inside feature pages to display a single metric.
 * Replaces the repeated ad-hoc `rounded-2xl border bg-background/70 p-4` pattern.
 *
 * @example
 * <InlineStatCard label="إجمالي العملاء" value={12} />
 * <InlineStatCard label="قيمة العقارات" value="450,000 ر.ع." />
 */
export function InlineStatCard({ label, value, className }: InlineStatCardProps) {
  return (
    <div className={cn('rounded-2xl border bg-background/70 p-4', className)}>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
