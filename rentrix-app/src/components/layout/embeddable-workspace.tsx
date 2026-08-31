import type { ReactNode } from 'react';
import { EntityTableViewModeProvider } from '@/components/ui/entity-table';
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
  /** Optional stable data hook for embedded hub workspaces. */
  workspaceName?: string;
  /** Embedded hubs can retain actions without repeating the child title. */
  embeddedHeader?: 'full' | 'actions-only' | 'none';
  /** Optional stable storage key shared by the register view control. */
  viewModeStorageKey?: string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  /** Kept for source compatibility while the app uses one shared visual system. */
  visualVariant?: 'malek-pro';
  children: ReactNode;
}>;

export function EmbeddableWorkspace({
  embedded = false,
  title,
  description,
  size = 'wide',
  dir,
  lang,
  className,
  contentClassName,
  count,
  workspaceName,
  // Embedded hubs already own the title hierarchy. Keep only reachable actions
  // at the top of the child workspace unless a consumer explicitly opts back
  // into the legacy full embedded header.
  embeddedHeader = embedded ? 'actions-only' : 'full',
  viewModeStorageKey,
  backTo,
  backLabel,
  primaryAction,
  secondaryActions,
  visualVariant = 'malek-pro',
  children,
}: EmbeddableWorkspaceProps) {
  if (embedded) {
    const hasActions = Boolean(primaryAction || secondaryActions);

    return (
      <div
        data-embedded-workspace
        data-workspace={workspaceName}
        data-visual-wave={visualVariant}
        className="min-w-0 space-y-2.5 sm:space-y-3"
      >
        {embeddedHeader === 'full' ? (
          <header
            data-embedded-workspace-header
            className="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 pb-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-black tracking-[-0.01em] sm:text-lg">{title}</h2>
              {count !== undefined ? (
                <span
                  className="inline-flex min-h-6 shrink-0 items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs font-bold tabular-nums text-muted-foreground"
                  aria-label={`عدد السجلات ${count}`}
                >
                  {count}
                </span>
              ) : null}
            </div>

            {hasActions ? (
              <div data-workspace-actions className="shrink-0" aria-label={`إجراءات ${title}`}>
                <PageHeaderActions
                  title={title}
                  primaryAction={primaryAction}
                  secondaryActions={secondaryActions}
                />
              </div>
            ) : null}
          </header>
        ) : embeddedHeader === 'actions-only' && hasActions ? (
          <div data-embedded-workspace-actions className="flex justify-end">
            <div data-workspace-actions aria-label={`إجراءات ${title}`}>
              <PageHeaderActions
                title={title}
                primaryAction={primaryAction}
                secondaryActions={secondaryActions}
              />
            </div>
          </div>
        ) : null}
        <EntityTableViewModeProvider
          storageKey={viewModeStorageKey ?? `malek:list-page:${title}`}
        >
          {children}
        </EntityTableViewModeProvider>
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
      <EntityTableViewModeProvider
        storageKey={viewModeStorageKey ?? `malek:list-page:${title}`}
      >
        {children}
      </EntityTableViewModeProvider>
    </PageLayout>
  );
}
