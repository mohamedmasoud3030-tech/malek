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

import { MalikBrand } from '@/components/brand/malik-brand';

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
          <MalikBrand showTagline className="scale-110 origin-right lg:scale-125" />
        </header>

        {/* Main illustration — Abstract cityscape */}
        <div className="flex flex-1 items-center justify-center py-6">
          <svg
            viewBox="0 0 400 280"
            className="h-auto w-full max-w-[380px] opacity-80"
            fill="none"
            aria-hidden="true"
            role="img"
          >
            {/* Base line */}
            <line x1="20" y1="240" x2="380" y2="240" stroke="hsl(var(--color-border))" strokeWidth="1" />

            {/* Building 1 — tall */}
            <rect x="40" y="100" width="50" height="140" rx="3" fill="hsl(var(--color-primary) / 0.05)" stroke="hsl(var(--color-primary) / 0.15)" strokeWidth="1" />
            <rect x="48" y="112" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.1)" />
            <rect x="64" y="112" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.1)" />
            <rect x="48" y="132" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.08)" />
            <rect x="64" y="132" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.1)" />
            <rect x="48" y="152" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.1)" />
            <rect x="64" y="152" width="10" height="12" rx="1" fill="hsl(var(--color-primary) / 0.08)" />

            {/* Building 2 — medium */}
            <rect x="105" y="140" width="45" height="100" rx="3" fill="hsl(var(--color-primary) / 0.04)" stroke="hsl(var(--color-primary) / 0.12)" strokeWidth="1" />

            {/* Building 3 — tallest */}
            <rect x="165" y="70" width="55" height="170" rx="3" fill="hsl(var(--color-primary) / 0.08)" stroke="hsl(var(--color-primary) / 0.2)" strokeWidth="1" />
            <line x1="192" y1="70" x2="192" y2="50" stroke="hsl(var(--color-primary) / 0.2)" strokeWidth="1.5" />
            <circle cx="192" cy="48" r="3" fill="hsl(var(--color-primary) / 0.3)" />

            {/* Building 4 — short */}
            <rect x="235" y="170" width="40" height="70" rx="3" fill="hsl(var(--color-primary) / 0.04)" stroke="hsl(var(--color-primary) / 0.12)" strokeWidth="1" />

            {/* Building 5 */}
            <rect x="290" y="120" width="48" height="120" rx="3" fill="hsl(var(--color-primary) / 0.06)" stroke="hsl(var(--color-primary) / 0.15)" strokeWidth="1" />

            {/* Decorative connection lines */}
            <path
              d="M 65 90 Q 130 60 192 48 Q 255 36 314 110"
              stroke="hsl(var(--color-primary) / 0.15)"
              strokeWidth="1"
              strokeDasharray="4 3"
              fill="none"
            />
          </svg>
        </div>

        {/* Footer info (Replaced metrics with a clean brand space) */}
        <div className="mt-auto pt-8 border-t border-border/10">
          <p className="text-sm font-semibold tracking-wide text-primary/80 uppercase">
            نظام إدارة الأملاك المتكامل
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground max-w-xs">
            قم بإدارة عقاراتك ومستنداتك ومستحقاتك المالية بكل سهولة وموثوقية في منصة واحدة متكاملة.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Internal sub-components (Removed PreviewMetric as requested) ────────────────────────── */
