/**
 * EnterpriseToolbar — Enterprise UX Foundation (Wave 4A)
 *
 * The horizontal control band above lists: search, filters, view toggles and
 * page-level actions. Wraps responsively (search owns the first row on small
 * screens) and can stick below the app header. Pure layout.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EnterpriseToolbarProps {
  /** Leading cluster — typically <EnterpriseSearch/>. */
  leading?: ReactNode;
  /** Filter controls (EnterpriseFilters, chips, selects…). */
  filters?: ReactNode;
  /** Trailing cluster — primary action, export, view toggle… */
  actions?: ReactNode;
  /** Extra row content (active filter chips, bulk indicator…). */
  children?: ReactNode;
  /** Pin the toolbar under the app header while scrolling lists. */
  sticky?: boolean;
  /** Visible card surface. Default true — set false over tinted canvases. */
  bordered?: boolean;
  className?: string;
}

export function EnterpriseToolbar({
  leading,
  filters,
  actions,
  children,
  sticky = false,
  bordered = true,
  className,
}: EnterpriseToolbarProps) {
  return (
    <div
      data-enterprise-toolbar
      className={cn(
        bordered && 'rounded-2xl border border-border bg-card px-3 py-3 shadow-card',
        sticky && 'sticky top-0 z-10',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {leading ? (
          <div className="min-w-0 flex-1 basis-full sm:basis-64" data-enterprise-toolbar-leading>
            {leading}
          </div>
        ) : null}
        {filters ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-2"
            data-enterprise-toolbar-filters
          >
            {filters}
          </div>
        ) : null}
        {actions ? (
          <div
            className="ms-auto flex shrink-0 items-center gap-2"
            data-enterprise-toolbar-actions
          >
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
