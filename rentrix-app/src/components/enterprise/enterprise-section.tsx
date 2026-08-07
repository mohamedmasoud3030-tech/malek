/**
 * EnterpriseSection — Enterprise UX Foundation (Wave 4A)
 *
 * Titled content section (inside pages, cards, drawers). Semantic <section>
 * with accessible heading, optional actions, and opt-in collapsing.
 */

import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typographyPresets } from './design-tokens';

export interface EnterpriseSectionProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  /** Allow the user to collapse the body. */
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Dense inner spacing for compact contexts (drawers, side panels). */
  dense?: boolean;
  className?: string;
  id?: string;
}

export function EnterpriseSection({
  title,
  description,
  actions,
  children,
  collapsible = false,
  defaultCollapsed = false,
  dense = false,
  className,
  id,
}: EnterpriseSectionProps) {
  const autoId = useId();
  const headingId = `${id ?? 'enterprise-section'}-${autoId}-heading`;
  const bodyId = `${id ?? 'enterprise-section'}-${autoId}-body`;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const hasHeader = title !== undefined || description !== undefined || actions !== undefined;

  return (
    <section
      data-enterprise-section
      aria-labelledby={title ? headingId : undefined}
      className={cn(className)}
    >
      {hasHeader ? (
        <div className={cn('mb-3 flex items-start justify-between gap-3', dense && 'mb-2')}>
          <div className="min-w-0">
            {title ? (
              collapsible ? (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => !prev)}
                  aria-expanded={!collapsed}
                  aria-controls={bodyId}
                  className="group flex items-center gap-1.5 rounded-md text-start focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
                >
                  <ChevronDown
                    className={cn(
                      'size-4 text-muted-foreground transition-transform duration-200',
                      collapsed && '-rotate-90 rtl:rotate-90',
                    )}
                    aria-hidden="true"
                  />
                  <h2 id={headingId} className={typographyPresets.sectionTitle}>
                    {title}
                  </h2>
                </button>
              ) : (
                <h2 id={headingId} className={typographyPresets.sectionTitle}>
                  {title}
                </h2>
              )
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}

      <div
        id={bodyId}
        hidden={collapsible && collapsed}
        data-enterprise-section-body
        className={cn(collapsible && collapsed && 'hidden')}
      >
        {children}
      </div>
    </section>
  );
}
