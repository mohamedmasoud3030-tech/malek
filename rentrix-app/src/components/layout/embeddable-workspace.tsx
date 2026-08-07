import type { ReactNode } from 'react';
import { PageHeader } from './page-header';
import { PageHeaderActions } from './page-header-actions';
import { PageLayout } from './page-layout';

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
  /** Scoped visual system for approved operational workspaces only. */
  visualVariant?: 'malek-pro';
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
  visualVariant,
  children,
}: EmbeddableWorkspaceProps) {
  if (embedded) {
    const hasActions = Boolean(primaryAction || secondaryActions);

    return (
      <div
        data-embedded-workspace
        data-visual-wave={visualVariant}
        className="min-w-0 space-y-4 sm:space-y-5"
      >
        {hasActions ? (
          <div data-workspace-actions className="flex justify-end" aria-label={`إجراءات ${title}`}>
            <PageHeaderActions
              title={title}
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
            />
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <PageLayout
      dir={dir}
      lang={lang}
      size={size}
      className={className}
      contentClassName={contentClassName}
      visualVariant={visualVariant}
    >
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
