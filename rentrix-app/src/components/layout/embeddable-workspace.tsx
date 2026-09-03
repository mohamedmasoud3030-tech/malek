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
  /** Optional stable storage key shared by the register view control. */
  viewModeStorageKey?: string;
  backTo?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  children: ReactNode;
}>;

/**
 * Canonical boundary between route pages and hub-embedded workspaces.
 *
 * A standalone route owns PageLayout + PageHeader. An embedded workspace owns
 * content and reachable actions only. There is intentionally no API for a
 * second embedded page identity or an alternate visual system.
 *
 * In hub grids, the embedded root participates as `display: contents`: actions
 * occupy the hub navigation row and workspace content occupies the row beneath
 * it. This keeps one canonical action system without wasting a standalone row
 * on a small create/action button.
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
  viewModeStorageKey,
  backTo,
  backLabel,
  primaryAction,
  secondaryActions,
  children,
}: EmbeddableWorkspaceProps) {
  if (embedded) {
    const hasActions = Boolean(primaryAction || secondaryActions);

    return (
      <div
        data-embedded-workspace
        data-workspace={workspaceName}
        data-malek-surface
        className="contents"
      >
        {hasActions ? (
          <div
            data-embedded-workspace-actions
            aria-label={`إجراءات ${title}`}
            className="col-start-2 row-start-1 flex min-w-0 max-w-[48vw] justify-end self-end justify-self-end"
          >
            <PageHeaderActions
              title={title}
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
            />
          </div>
        ) : null}
        <div
          data-embedded-workspace-content
          className="col-span-full row-start-2 min-w-0 space-y-2.5 sm:space-y-3"
        >
          <EntityTableViewModeProvider
            storageKey={viewModeStorageKey ?? `malek:list-page:${title}`}
          >
            {children}
          </EntityTableViewModeProvider>
        </div>
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
