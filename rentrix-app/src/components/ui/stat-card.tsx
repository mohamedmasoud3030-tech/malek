import { cn } from "@/lib/utils";

type StatTone = "default" | "success" | "warning" | "danger" | "info";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
  className?: string;
}

/**
 * Tones consume the semantic status tokens (--color-*-text / --color-*-bg
 * from styles/tokens.css) so the card follows the app theme toggle
 * ([data-theme='dark']) exactly like StatusBadge — no raw palette colors
 * and no prefers-color-scheme-only variants.
 */
const toneMap: Record<StatTone, { bg: string; value: string }> = {
  default: { bg: "bg-muted/60", value: "text-foreground" },
  success: { bg: "bg-success-bg", value: "text-success" },
  warning: { bg: "bg-warning-bg", value: "text-warning" },
  danger: { bg: "bg-danger-bg", value: "text-danger" },
  info: { bg: "bg-info-bg", value: "text-info" },
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
    <div data-stat-card data-tone={tone} className={cn("rounded-2xl p-3", colors.bg, className)}>
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-base font-bold tabular-nums leading-none", colors.value)} dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}
