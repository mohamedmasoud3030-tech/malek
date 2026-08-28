import type { ReactNode } from 'react';
import { LoadingState } from '@/components/ui/loading-state';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/ui/state-surfaces';

interface AsyncContentStateProps {
  status: 'loading' | 'error' | 'empty' | 'ready';
  error?: unknown;
  errorTitle?: string;
  errorFallbackMessage?: string;
  errorAction?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}

/**
 * Unified loading/error/empty/ready wrapper for pages that fetch data.
 * Reuses the existing LoadingState (route variant), DataErrorScreen, and EmptyState —
 * it does not introduce a new visual treatment, only a single place to
 * decide which of the four states applies instead of re-deriving the same
 * `isLoading`/`isError`/`!data` chain on every page.
 *
 * Never renders the empty state while loading or erroring — `status`
 * should be computed by the caller as a single discriminant, e.g.:
 * `query.isLoading ? 'loading' : query.isError ? 'error' : !query.data ? 'empty' : 'ready'`
 *
 * @example
 * <AsyncContentState
 *   status={contractQuery.isLoading ? 'loading' : contractQuery.isError ? 'error' : !contractQuery.data ? 'empty' : 'ready'}
 *   error={contractQuery.error}
 *   errorTitle="تعذر تحميل العقد"
 *   emptyTitle="العقد غير موجود"
 *   emptyDescription="ربما تم حذف العقد أو لا تملك صلاحية الوصول إليه."
 * >
 *   {contractQuery.data && <ContractDetailBody contract={contractQuery.data} />}
 * </AsyncContentState>
 */
export function AsyncContentState({
  status,
  error,
  errorTitle = 'تعذر تحميل البيانات',
  errorFallbackMessage,
  errorAction,
  emptyTitle = 'لا توجد بيانات',
  emptyDescription = 'لا توجد عناصر لعرضها حالياً.',
  emptyAction,
  children,
}: AsyncContentStateProps) {
  if (status === 'loading') return <LoadingState variant="route" />;
  if (status === 'error') return <DataErrorScreen title={errorTitle} fallbackMessage={errorFallbackMessage} error={error} action={errorAction} />;
  if (status === 'empty') return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  return <>{children}</>;
}
