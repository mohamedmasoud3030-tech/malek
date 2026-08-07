/**
 * EnterpriseStickyFooter — Enterprise UX Foundation (Wave 4A)
 *
 * Bottom action bar that sticks to its scroll container (drawer, page,
 * modal body). Safe-area aware, RTL-aware, and elevation-aware: the shadow
 * appears over scrolling content. Pure layout — no logic.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterpriseStickyFooterProps {
  children: ReactNode;
  /** Alignment of the action cluster. */
  align?: 'start' | 'end' | 'between' | 'center';
  /** Render the top separator line. Default true. */
  withBorder?: boolean;
  /**
   * `sticky` (default) pins to the bottom of the nearest scrolling ancestor.
   * `static` renders as a plain section footer (e.g. last card on the page).
   */
  position?: 'sticky' | 'static';
  /** Show the elevated shadow above the bar. Default true for sticky. */
  elevated?: boolean;
  className?: string;
}

const alignClasses: Record<NonNullable<EnterpriseStickyFooterProps['align']>, string> = {
  start: 'justify-start',
  end: 'justify-end',
  between: 'justify-between',
  center: 'justify-center',
};

export function EnterpriseStickyFooter({
  children,
  align = 'end',
  withBorder = true,
  position = 'sticky',
  elevated,
  className,
}: EnterpriseStickyFooterProps) {
  const shadowed = elevated ?? position === 'sticky';

  return (
    <div
      data-enterprise-sticky-footer
      className={cn(
        'bg-card',
        position === 'sticky' &&
          'sticky bottom-0 z-10',
        withBorder && 'border-t border-border',
        shadowed && position === 'sticky' && 'shadow-[0_-8px_24px_-16px_rgb(15_23_42/0.25)]',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col-reverse gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:flex-row sm:items-center sm:px-6',
          alignClasses[align],
        )}
      >
        {children}
      </div>
    </div>
  );
}
