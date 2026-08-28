import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ResponsiveCardGridProps = Readonly<{
  children: ReactNode;
  className?: string;
  /**
   * MALEK density contract: two columns is the default ceiling everywhere.
   * Three columns is allowed only when a screen opts into it explicitly.
   * Legacy values 4–7 are accepted for source compatibility but collapse to 2.
   */
  desktopColumns?: 2 | 3 | 4 | 5 | 6 | 7;
  gap?: 'sm' | 'md' | 'lg';
  as?: 'div' | 'section' | 'dl';
  /** Passed through when `as="section"` (or any labelled landmark) needs an accessible name. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /**
   * Optional extra boolean-style data attribute (e.g. a section-specific
   * marker like `data-finance-kpi-grid`) for callers that wrap this
   * component and need to preserve an existing selector/test hook while
   * still sharing this single column-count enforcement point.
   */
  'data-finance-kpi-grid'?: string;
  /**
   * Canonical report pattern marker (Summary → Visual Insight → Detailed
   * Table). Report sections set this on their summary KPI grid so the
   * pattern contract stays observable without per-page wrappers.
   */
  'data-report-summary'?: string;
}>;

const gapClasses = {
  sm: 'gap-2.5',
  md: 'gap-3',
  lg: 'gap-4',
} as const;

/**
 * Canonical repeated-card layout.
 *
 * - Mobile: fixed 2×N rhythm.
 * - Desktop: remains 2 columns by default; operational metrics may opt into
 *   3 columns, while a bounded set of four short KPIs may use 4 columns.
 * - Legacy requests for 5+ columns intentionally collapse to 2 so dense
 *   dashboards do not become sparse strips of tiny cards.
 * - Odd final cards fill the remaining mobile row; two-column desktop grids
 *   keep that full-row treatment so pages do not end with a large empty gap.
 */
export function ResponsiveCardGrid({
  children,
  className,
  desktopColumns = 2,
  gap = 'md',
  as: Component = 'div',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'data-finance-kpi-grid': financeKpiGridMarker,
  'data-report-summary': reportSummaryMarker,
}: ResponsiveCardGridProps) {
  const desktopGrid = desktopColumns === 4 ? '4' : desktopColumns === 3 ? '3' : '2';

  return (
    <Component
      data-responsive-card-grid
      data-finance-kpi-grid={financeKpiGridMarker}
      data-report-summary={reportSummaryMarker}
      data-desktop-columns={desktopGrid}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        'grid min-w-0 grid-cols-2',
        desktopGrid === '4'
          ? '[&>*:last-child:nth-child(odd)]:col-span-2 lg:grid-cols-4 lg:[&>*:last-child:nth-child(odd)]:col-span-1'
          : desktopGrid === '3'
            ? '[&>*:last-child:nth-child(odd)]:col-span-2 lg:grid-cols-3 lg:[&>*:last-child:nth-child(odd)]:col-span-1'
            : '[&>*:last-child:nth-child(odd)]:col-span-2',
        gapClasses[gap],
        '[&>*]:min-w-0',
        className,
      )}
    >
      {children}
    </Component>
  );
}
