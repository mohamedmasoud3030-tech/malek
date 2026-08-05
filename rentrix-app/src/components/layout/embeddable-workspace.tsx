import type { ReactNode } from 'react';
import { PageHeader } from './page-header';
import { PageHeaderActions } from './page-header-actions';
import { PageLayout } from './page-layout';

/**
 * The single place that decides whether a workspace renders its own page shell.
 *
 * A workspace body is written once and rendered in two contexts:
 *  - standalone: reached by its own route, so it owns the PageLayout + PageHeader
 *  - embedded:   rendered inside a hub that already supplies the shell, so it
 *                must not emit a second layout or header
 *
 * Routing every finance page through this component is what makes
 * "no duplicated layouts / no duplicated headers" a structural guarantee
 * instead of a convention each page has to remember.
 *
 * Page-level actions are preserved in embedded mode: instead of being dropped
 * with the header, they render in a compact action rail above the content, so
 * embedding never silently removes functionality.
 */
export type EmbeddableWorkspaceProps = Readonly<{
  embedded?: boolean;
  title: string;
  description?: string;
  size?: 'default' | 'wide' | 'full';
  dir?: 'rtl' | 'ltr';
  lang?: string;
  className?: string;
  contentClassName?: string;
  count?: number | string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  children: ReactNode;
}>;

export function EmbeddableWorkspace({
  embedded = false,
  title,
  description,
  size = 'wide',
  dir = 'rtl',
  lang = 'ar',
  className,
  contentClassName,
  count,
  backTo,
  backLabel,
  primaryAction,
  secondaryActions,
  children,
}: EmbeddableWorkspaceProps) {
  if (embedded) {
    const hasActions = Boolean(primaryAction || secondaryActions);

    return (
      <div data-embedded-workspace className="min-w-0 space-y-5 sm:space-y-6">
        {hasActions ? (
          <div data-workspace-actions className="flex justify-end" aria-label={`إجراءات ${title}`}>
            <PageHeaderActions title={title} primaryAction={primaryAction} secondaryActions={secondaryActions} />
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <PageLayout dir={dir} lang={lang} size={size} className={className} contentClassName={contentClassName}>
      <PageHeader
        title={title}
        description={description}
        count={count}
        backTo={backTo}
        backLabel={backLabel}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
      {children}
    </PageLayout>
  );
}
