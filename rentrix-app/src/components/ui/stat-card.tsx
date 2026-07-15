import { cn } from "@/lib/utils";

type StatTone = "default" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
  className?: string;
}

const toneMap: Record<StatTone, { bg: string; value: string }> = {
  default:  { bg: "bg-muted/60",                    value: "text-foreground" },
  success:  { bg: "bg-emerald-50 dark:bg-emerald-950/30", value: "text-emerald-600 dark:text-emerald-400" },
  warning:  { bg: "bg-amber-50 dark:bg-amber-950/30",    value: "text-amber-600 dark:text-amber-400" },
  danger:   { bg: "bg-rose-50 dark:bg-rose-950/30",      value: "text-rose-600 dark:text-rose-400" },
  info:     { bg: "bg-sky-50 dark:bg-sky-950/30",        value: "text-sky-600 dark:text-sky-400" },
};

/**
 * Small metric cell used in financial summary grids.
 * Replaces the repeated `rounded-2xl bg-muted/60 p-3` pattern in FinancialSummary.
 *
 * @example
 * <StatCard label="المحصّل" value={money(settings, collected)} tone="success" />
 */
export function StatCard({ label, value, sub, tone = "default", className }: StatCardProps) {
  const colors = toneMap[tone];
  return (
    <div className={cn("rounded-2xl p-3", colors.bg, className)}>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-base font-bold tabular-nums leading-none", colors.value)} dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}
