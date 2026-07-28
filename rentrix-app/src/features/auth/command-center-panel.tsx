/**
 * CommandCenterPanel — Presentation-only visual component.
 *
 * Renders a "MALIK Command Center" decorative illustration using
 * inline SVG and CSS. All metrics shown are static preview data —
 * they are NOT connected to any API, database, or real user data.
 *
 * This component:
 * - Receives no props and exposes no callbacks.
 * - Makes no network requests.
 * - Renders only decorative content (aria-hidden where appropriate).
 * - Respects prefers-reduced-motion.
 * - Uses only design tokens from the project's token system.
 */

import { APP_BRAND_NAME, APP_BRAND_TAGLINE_AR } from '@/lib/brand';

export function CommandCenterPanel() {
  return (
    <div
      className="relative hidden h-full flex-col overflow-hidden md:flex"
      data-command-center-panel
      dir="rtl"
    >
      {/* Background: subtle grid + geometric shapes */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(135deg, hsl(var(--color-primary) / 0.04) 0%, transparent 50%),
            linear-gradient(hsl(var(--color-text-primary) / 0.025) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--color-text-primary) / 0.025) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 32px 32px, 32px 32px',
        }}
      />

      {/* Decorative circles */}
      <div
        aria-hidden="true"
        className="absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-[0.04] dark:opacity-[0.06]"
        style={{ background: 'hsl(var(--color-primary))' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full opacity-[0.03] dark:opacity-[0.05]"
        style={{ background: 'hsl(var(--color-primary))' }}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6 lg:p-8">
        {/* Header */}
        <header>
          <div className="flex items-center gap-3">
            <div>
              <p className="malik-wordmark tracking-[0.16em] text-sm font-extrabold text-foreground" dir="ltr">
                {APP_BRAND_NAME}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{APP_BRAND_TAGLINE_AR}</p>
            </div>
          </div>
        </header>

        {/* Main illustration — Abstract cityscape with KPI indicators */}
        <div className="flex flex-1 items-center justify-center py-6">
          <svg
            viewBox="0 0 400 280"
            className="h-auto w-full max-w-[340px]"
            fill="none"
            aria-hidden="true"
            role="img"
          >
            {/* Base line */}
            <line x1="20" y1="240" x2="380" y2="240" stroke="hsl(var(--color-border))" strokeWidth="1" />

            {/* Building 1 — tall */}
            <rect x="40" y="100" width="50" height="140" rx="3" fill="hsl(var(--color-primary) / 0.08)" stroke="hsl(var(--color-primary) / 0.2)" strokeWidth="1" />
            <rect x="48" y="112" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="64" y="112" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="48" y="132" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="64" y="132" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="48" y="152" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="64" y="152" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="48" y="172" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="64" y="172" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="48" y="192" width="10" height="12" rx="1" fill="hsl(var(--color-warning-bg))" />
            <rect x="64" y="192" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />

            {/* Building 2 — medium */}
            <rect x="105" y="140" width="45" height="100" rx="3" fill="hsl(var(--color-primary) / 0.06)" stroke="hsl(var(--color-primary) / 0.15)" strokeWidth="1" />
            <rect x="113" y="152" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />
            <rect x="127" y="152" width="8" height="10" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="113" y="170" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />
            <rect x="127" y="170" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />
            <rect x="113" y="188" width="8" height="10" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="127" y="188" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />

            {/* Building 3 — tallest */}
            <rect x="165" y="70" width="55" height="170" rx="3" fill="hsl(var(--color-primary) / 0.1)" stroke="hsl(var(--color-primary) / 0.25)" strokeWidth="1" />
            <rect x="174" y="84" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="190" y="84" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="206" y="84" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="174" y="104" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="190" y="104" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="206" y="104" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="174" y="124" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="190" y="124" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="206" y="124" width="10" height="12" rx="1" fill="hsl(var(--color-warning-bg))" />
            <rect x="174" y="144" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="190" y="144" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="206" y="144" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="174" y="164" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="190" y="164" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="206" y="164" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="174" y="184" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="190" y="184" width="10" height="12" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="206" y="184" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            {/* Antenna */}
            <line x1="192" y1="70" x2="192" y2="50" stroke="hsl(var(--color-primary) / 0.3)" strokeWidth="1.5" />
            <circle cx="192" cy="48" r="3" fill="hsl(var(--color-primary) / 0.4)" />

            {/* Building 4 — short */}
            <rect x="235" y="170" width="40" height="70" rx="3" fill="hsl(var(--color-primary) / 0.07)" stroke="hsl(var(--color-primary) / 0.18)" strokeWidth="1" />
            <rect x="243" y="182" width="8" height="10" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="257" y="182" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />
            <rect x="243" y="200" width="8" height="10" rx="1" fill="hsl(var(--color-primary) / 0.12)" />
            <rect x="257" y="200" width="8" height="10" rx="1" fill="hsl(var(--color-warning-bg))" />

            {/* Building 5 */}
            <rect x="290" y="120" width="48" height="120" rx="3" fill="hsl(var(--color-primary) / 0.09)" stroke="hsl(var(--color-primary) / 0.2)" strokeWidth="1" />
            <rect x="298" y="132" width="9" height="11" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="313" y="132" width="9" height="11" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="298" y="151" width="9" height="11" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="313" y="151" width="9" height="11" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="298" y="170" width="9" height="11" rx="1" fill="hsl(var(--color-success-bg))" />
            <rect x="313" y="170" width="9" height="11" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="298" y="189" width="9" height="11" rx="1" fill="hsl(var(--color-primary) / 0.15)" />
            <rect x="313" y="189" width="9" height="11" rx="1" fill="hsl(var(--color-warning-bg))" />

            {/* Dashboard connection lines (abstract) */}
            <path
              d="M 65 90 Q 130 60 192 48 Q 255 36 314 110"
              stroke="hsl(var(--color-primary) / 0.2)"
              strokeWidth="1"
              strokeDasharray="4 3"
              fill="none"
            />

            {/* Small status indicators floating */}
            <circle cx="350" cy="80" r="4" fill="hsl(var(--color-success))" opacity="0.6" />
            <circle cx="30" cy="180" r="3" fill="hsl(var(--color-info))" opacity="0.5" />
          </svg>
        </div>

        {/* Preview KPI Cards — static illustrative data */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <PreviewMetric label="وحدة" value="128" trend="up" />
            <PreviewMetric label="عقد" value="94" trend="stable" />
            <PreviewMetric label="نسبة الإشغال" value="87%" trend="up" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PreviewMetric label="تحصيلات الشهر" value="OMR 42K" trend="up" />
            <PreviewMetric label="طلبات صيانة نشطة" value="6" trend="stable" />
          </div>
        </div>

        {/* Footer caption */}
        <p className="mt-4 text-center text-[10px] text-muted-foreground/70">
          بيانات توضيحية فقط — الأرقام الفعلية تظهر بعد تسجيل الدخول
        </p>
      </div>
    </div>
  );
}

/* ── Internal sub-components ────────────────────────── */

function PreviewMetric({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}) {
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-danger'
        : 'text-muted-foreground';

  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className="rounded-lg border border-border/60 bg-card/80 px-2.5 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
      <p className={`text-[10px] font-medium ${trendColor}`}>{trendSymbol}</p>
    </div>
  );
}
