import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type ReportBarSeries = Readonly<{
  dataKey: string;
  name: string;
  /** Maps to a design token colour; `negative` is the destructive token. */
  tone?: 'primary' | 'negative' | 'muted';
}>;

type ReportBarChartProps = Readonly<{
  data: readonly unknown[];
  series: readonly ReportBarSeries[];
  xKey: string;
  /** Accessible name for the chart region. */
  ariaLabel: string;
  className?: string;
  showLegend?: boolean;
}>;

const TONE_FILL: Record<NonNullable<ReportBarSeries['tone']>, string> = {
  primary: 'hsl(var(--primary))',
  negative: 'hsl(var(--destructive))',
  muted: 'hsl(var(--muted-foreground))',
};

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } as const;

/**
 * WP-C — shared report bar chart (single canonical chart primitive).
 *
 * Reports previously inlined their only chart (the operating cash comparison in
 * the overview) with raw recharts markup: token colours, tick styling and the
 * responsive wrapper were all hand-written and could not be reused by the next
 * surface that needs a bar comparison. This is the single neutral chart
 * primitive — RTL-safe (it fills its container instead of a fixed pixel width),
 * keyboard/inert-safe (decorative, labelled region) and theme-token driven.
 * Lives in the shared UI layer because both Reports and the Today command
 * center compose it; no second chart abstraction may be introduced.
 *
 * Presentation only: it renders whatever series the caller already computed.
 */
export function ReportBarChart({
  data,
  series,
  xKey,
  ariaLabel,
  className = 'h-72 sm:h-80',
  showLegend = true,
}: ReportBarChartProps) {
  return (
    <div className={className} role="img" aria-label={ariaLabel} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data as unknown[]} margin={{ top: 12, right: 0, left: 0, bottom: 0 }} barGap={6}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis tickLine={false} axisLine={false} width={58} tick={AXIS_TICK} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
            }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          {series.map((item) => (
            <Bar
              key={item.dataKey}
              dataKey={item.dataKey}
              name={item.name}
              fill={TONE_FILL[item.tone ?? 'primary']}
              radius={[6, 6, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
