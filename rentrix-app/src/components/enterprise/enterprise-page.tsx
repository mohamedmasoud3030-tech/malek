/**
 * EnterprisePage — Enterprise UX Foundation (Wave 4A)
 *
 * Standard page shell every future module composes:
 *   header → stats → toolbar → content → footer
 * with consistent vertical rhythm, max-width, and page-level
 * loading/error/empty gating. Pure layout — zero business logic.
 *
 * @example
 * <EnterprisePage
 *   title="العقود"
 *   description="إدارة عقود الإيجار"
 *   actions={<Button>عقد جديد</Button>}
 *   stats={<EnterpriseStats items={stats} />}
 *   toolbar={<EnterpriseToolbar search={...} filters={...} />}
 *   isLoading={query.isLoading}
 *   error={query.error}
 *   onRetry={query.refetch}
 * >
 *   <EnterpriseDataTable ... />
 * </EnterprisePage>
 */

import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EnterpriseHeader, type EnterpriseBreadcrumb } from './enterprise-header';
import { EnterpriseLoadingState } from './enterprise-loading-state';
import { EnterpriseErrorState } from './enterprise-error-state';

export interface EnterprisePageProps {
  /** Page title (rendered as the page's single <h1>). */
  title?: string;
  description?: string;
  breadcrumbs?: EnterpriseBreadcrumb[];
  icon?: ComponentType<{ className?: string }>;
  /** Custom header node replaces the auto header entirely. */
  header?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;

  /** KPI band under the header. */
  stats?: ReactNode;
  /** Search / filters / bulk bar band. */
  toolbar?: ReactNode;
  /** Page body (table, cards, forms…). */
  children?: ReactNode;
  /** Bottom band (e.g. sticky save bar for page-level forms). */
  footer?: ReactNode;

  /** Content column width. `xl` matches the widest tokens container. */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Vertical spacing between bands. */
  gap?: 'sm' | 'md' | 'lg';

  // Page-level state gating (loading > error > content)
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
  errorTitle?: string;

  className?: string;
}

const maxWidthClasses: Record<NonNullable<EnterprisePageProps['maxWidth']>, string> = {
  sm: 'max-w-[40rem]',
  md: 'max-w-[48rem]',
  lg: 'max-w-[64rem]',
  xl: 'max-w-[80rem]',
  '2xl': 'max-w-[96rem]',
  full: 'max-w-full',
};

const gapClasses: Record<NonNullable<EnterprisePageProps['gap']>, string> = {
  sm: 'gap-3',
  md: 'gap-4 sm:gap-5',
  lg: 'gap-6 sm:gap-8',
};

export function EnterprisePage({
  title,
  description,
  breadcrumbs,
  icon,
  header,
  actions,
  meta,
  stats,
  toolbar,
  children,
  footer,
  maxWidth = 'full',
  gap = 'md',
  isLoading = false,
  error = null,
  onRetry,
  loadingLabel,
  errorTitle,
  className,
}: EnterprisePageProps) {
  const resolvedHeader =
    header ??
    (title !== undefined ? (
      <EnterpriseHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
        icon={icon}
        actions={actions}
        meta={meta}
      />
    ) : null);

  const showContent = !isLoading && error == null;

  return (
    <div
      data-enterprise-page
      className={cn(
        'mx-auto flex w-full flex-col',
        maxWidthClasses[maxWidth],
        gapClasses[gap],
        className,
      )}
    >
      {resolvedHeader}

      {stats ? <div data-enterprise-page-stats>{stats}</div> : null}

      {toolbar ? <div data-enterprise-page-toolbar>{toolbar}</div> : null}

      {isLoading ? (
        <EnterpriseLoadingState context="page" label={loadingLabel} />
      ) : error != null ? (
        <EnterpriseErrorState title={errorTitle} error={error} onRetry={onRetry} />
      ) : null}

      {showContent ? <div data-enterprise-page-content className="min-w-0">{children}</div> : null}

      {footer ? <div data-enterprise-page-footer>{footer}</div> : null}
    </div>
  );
}
