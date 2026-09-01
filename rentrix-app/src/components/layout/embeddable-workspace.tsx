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
  /**
   * Embedded hubs never own a second page identity. `full` remains accepted
   * temporarily for source compatibility, but is normalized to actions-only.
   */
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

/**
 * Canonical boundary between route pages and hub-embedded workspaces.
 *
 * A standalone route owns PageLayout + PageHeader. An embedded workspace owns
 * content and reachable actions only. This invariant prevents the historical
 * "hub header + child page header" duplication from returning through feature
 * code or stale props.
 */
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
    const showActions = embeddedHeader !== 'none' && hasActions;

    return (
      <div
        data-embedded-workspace
        data-workspace={workspaceName}
        data-visual-wave={visualVariant}
        className="min-w-0 space-y-2.5 sm:space-y-3"
      >
        {showActions ? (
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
