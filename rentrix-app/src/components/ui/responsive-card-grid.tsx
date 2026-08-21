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
  /**
   * Optional extra boolean-style data attribute (e.g. a section-specific
   * marker like `data-finance-kpi-grid`) for callers that wrap this
   * component and need to preserve an existing selector/test hook while
   * still sharing this single column-count enforcement point.
   */
  'data-finance-kpi-grid'?: string;
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
 * - Desktop: remains 2 columns by default; an explicit `desktopColumns={3}`
 *   is the only supported wider rhythm.
 * - Legacy requests for 4+ columns intentionally collapse to 2 so dense
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
  'data-finance-kpi-grid': financeKpiGridMarker,
}: ResponsiveCardGridProps) {
  const allowThreeColumns = desktopColumns === 3;

  return (
    <Component
      data-responsive-card-grid
      data-finance-kpi-grid={financeKpiGridMarker}
      data-desktop-columns={allowThreeColumns ? '3' : '2'}
      className={cn(
        'grid min-w-0 grid-cols-2',
        allowThreeColumns
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
