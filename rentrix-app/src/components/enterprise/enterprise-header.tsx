/**
 * EnterpriseHeader — Enterprise UX Foundation (Wave 4A)
 *
 * Standard page header: breadcrumbs, icon, title, description and actions.
 * Renders exactly one <h1> for the page (use `headingLevel` in embeds).
 * RTL-first: breadcrumbs flow with the document direction.
 */

import { createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typographyPresets } from './design-tokens';

export interface EnterpriseBreadcrumb {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EnterpriseHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: EnterpriseBreadcrumb[];
  /** Leading icon container (lucide icon or any component). */
  icon?: ComponentType<{ className?: string }>;
  /** Action cluster (buttons, menus) rendered at the trailing edge. */
  actions?: ReactNode;
  /** Secondary row under the title (meta info, status chips…). */
  meta?: ReactNode;
  /** Heading depth — `1` for pages (default), `2`+ when embedded. */
  headingLevel?: 1 | 2;
  /** Pins the header to the top of the scrolling container. */
  sticky?: boolean;
  className?: string;
}

export function EnterpriseHeader({
  title,
  description,
  breadcrumbs,
  icon: Icon,
  actions,
  meta,
  headingLevel = 1,
  sticky = false,
  className,
}: EnterpriseHeaderProps) {
  const HeadingTag = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <header
      data-enterprise-header
      className={cn(
        'flex flex-col gap-3',
        sticky &&
          'sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="مسار التنقل">
          <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-muted-foreground">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? (
                    <ChevronLeft className="size-3.5 opacity-50" aria-hidden="true" />
                  ) : null}
                  <li aria-current={isLast ? 'page' : undefined}>
                    {crumb.href && !isLast ? (
                      <a
                        href={crumb.href}
                        onClick={crumb.onClick}
                        className="rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className={cn(isLast && 'text-foreground')}>{crumb.label}</span>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              data-enterprise-header-icon
              className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              {createElement(Icon, { className: 'size-5' })}
            </span>
          ) : null}
          <div className="min-w-0">
            <HeadingTag className={cn('truncate', typographyPresets.pageTitle)}>
              {title}
            </HeadingTag>
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2" data-enterprise-header-actions>
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
