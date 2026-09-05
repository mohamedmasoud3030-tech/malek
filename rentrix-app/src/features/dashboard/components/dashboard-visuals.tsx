import { memo } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { SemanticTone } from '@/components/ui/status-badge';

/**
 * Command center visualization vocabulary.
 *
 * Small presentation-only primitives composed from MALEK semantic tokens.
 * They render values handed to them by authoritative signals — they never
 * read data, derive money numbers, or introduce a second design system.
 * Every visual keeps its value available as text next to it (accessibility:
 * the chart is never the sole representation).
 */

export const TrendDelta = memo(function TrendDelta({
  direction,
  text,
  tone = 'neutral',
  className,
}: Readonly<{
  direction: 'up' | 'down' | 'neutral';
  text: string;
  tone?: SemanticTone;
  className?: string;
}>) {
  const toneClass =
    tone === 'success'
      ? 'text-success bg-success/10'
      : tone === 'warning'
        ? 'text-warning bg-warning/10'
        : tone === 'danger'
          ? 'text-danger bg-danger/10'
          : 'text-muted-foreground bg-muted';

  return (
    <span
      className={cn('inline-flex min-h-6 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums', toneClass, className)}
      data-dashboard-trend-delta
    >
      <span aria-hidden="true">{direction === 'up' ? '↑' : direction === 'down' ? '↓' : '–'}</span>
      {text}
    </span>
  );
});

/**
 * Compact radial/donut occupancy indicator. Decorative SVG — the numeric
 * value is always rendered beside it by the caller.
 */
export const RadialMetric = memo(function RadialMetric({
  percent,
  label,
  className,
  trackClass = 'text-muted/60',
  fillClass = 'text-primary',
  size = 84,
}: Readonly<{
  percent: number;
  label: string;
  className?: string;
  trackClass?: string;
  fillClass?: string;
  size?: number;
}>) {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safePercent / 100) * circumference;

  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)} data-dashboard-radial-metric>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
        className="block"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={cn('stroke-current', trackClass)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn('stroke-current transition-[stroke-dasharray] duration-500 motion-reduce:transition-none', fillClass)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className="text-lg font-black tabular-nums text-foreground" dir="ltr">{Math.round(safePercent)}%</span>
      </span>
    </span>
  );
});

/**
 * Two-value horizontal comparison (collections vs expenses). Widths are
 * relative to the larger value; the actual numbers stay visible as text.
 */
export const MiniBarsCompare = memo(function MiniBarsCompare({
  items,
  className,
}: Readonly<{
  items: readonly { label: string; value: number; displayValue: string; barClass: string }[];
  className?: string;
}>) {
  const max = Math.max(...items.map((item) => item.value), 0);

  return (
    <div className={cn('min-w-0 space-y-1.5', className)} data-dashboard-mini-bars>
      {items.map((item) => {
        const width = max > 0 ? Math.max(4, Math.round((item.value / max) * 100)) : 0;
        return (
          <div key={item.label} className="min-w-0">
            <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 tabular-nums text-foreground" dir="ltr">{item.displayValue}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', item.barClass)}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});

/**
 * Linear progress meter with an explicit textual value (collection rate).
 */
export const ProgressMeter = memo(function ProgressMeter({
  percent,
  label,
  valueText,
  barClass = 'bg-primary',
  className,
}: Readonly<{
  percent: number;
  label: string;
  valueText: string;
  barClass?: string;
  className?: string;
}>) {
  const safePercent = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));

  return (
    <div className={cn('min-w-0', className)} data-dashboard-progress>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate text-[11px] font-bold text-muted-foreground">{label}</span>
        <span className="shrink-0 text-sm font-black tabular-nums text-foreground" dir="ltr">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(safePercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none', barClass)}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
});

/**
 * Distribution strip: shares of a whole as proportional segments with a
 * legend (vacancy aging / arrears aging). Values remain visible as text.
 */
export const DistributionStrip = memo(function DistributionStrip({
  segments,
  total,
  label,
  className,
}: Readonly<{
  segments: readonly { key: string; label: string; count: number; barClass: string }[];
  total: number;
  label: string;
  className?: string;
}>) {
  const safeTotal = Math.max(total, 0);

  return (
    <div className={cn('min-w-0', className)} data-dashboard-distribution>
      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={label}
        dir="ltr"
      >
        {safeTotal > 0
          ? segments.map((segment) =>
            segment.count > 0 ? (
              <span
                key={segment.key}
                className={cn('h-full rounded-sm', segment.barClass)}
                style={{ width: `${Math.max(2, (segment.count / safeTotal) * 100)}%` }}
              />
            ) : null)
          : null}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" role="list" aria-label={label}>
        {segments.map((segment) => (
          <li key={segment.key} className="flex min-w-0 items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5 font-bold text-muted-foreground">
              <span className={cn('size-2 shrink-0 rounded-full', segment.barClass)} aria-hidden="true" />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 font-extrabold tabular-nums text-foreground">{segment.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * Small labelled stat used in dense metric columns — number first, context
 * below, optional trailing node (trend delta).
 */
export const MetricStat = memo(function MetricStat({
  label,
  value,
  hint,
  trailing,
  className,
}: Readonly<{
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-3 py-2', className)} data-dashboard-metric-stat>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-base font-black tabular-nums leading-6 text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{hint}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
});
