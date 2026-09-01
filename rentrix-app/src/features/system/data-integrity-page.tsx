import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useActiveCompanyId } from '@/hooks/use-company';
import { APP_BRAND_NAME } from '@/lib/brand';
import { DataIntegrityView } from './components/data-integrity-view';
import { runDataIntegrityAudit } from './services/data-integrity-service';
import type { DataIntegrityResult } from './types';

export function getDataIntegrityViewState(query: { isPending: boolean; isError: boolean; error: unknown; data: DataIntegrityResult | undefined }) {
  if (query.isPending) return { status: 'loading' } as const;
  // A failed background refresh must not replace a previously verified
  // snapshot with a full-page error. Keep the snapshot visible and label it as
  // stale until the operator retries or reconnect reconciliation succeeds.
  if (query.data !== undefined) {
    return { status: 'ready', result: query.data, refreshError: query.isError ? query.error : null } as const;
  }
  if (query.isError) return { status: 'error', error: query.error } as const;
  return { status: 'error', error: new Error('DATA_INTEGRITY_RESULT_MISSING') } as const;
}

export type DataIntegrityWorkspaceVariant = 'standalone' | 'embedded';

type DataIntegrityWorkspaceProps = Readonly<{
  /**
   * 'standalone' (default) preserves the historical /data-integrity route:
   * content renders inside its own PageLayout + PageHeader. 'embedded'
   * drops both so the content can be hosted inside the governance hub
   * without duplicating page chrome.
   */
  variant?: DataIntegrityWorkspaceVariant;
}>;

export function DataIntegrityWorkspace({ variant = 'standalone' }: DataIntegrityWorkspaceProps = {}) {
  const { authorization } = useAuth();
  const activeCompanyId = useActiveCompanyId();
  const hasAccess = canAccess(authorization, 'integrity.view');
  const integrityQuery = useQuery({
    // Defense in depth: never let one company's audit snapshot share a cache
    // identity with another company, even though CompanyProvider also clears
    // the cache during a verified tenant switch.
    queryKey: ['data-integrity-audit', activeCompanyId],
    queryFn: runDataIntegrityAudit,
    enabled: hasAccess && Boolean(activeCompanyId),
  });

  if (!hasAccess) {
    return <AccessDenied message="فحوصات سلامة البيانات متاحة فقط للمدير أو المسؤول." />;
  }

  const state = getDataIntegrityViewState(integrityQuery);

  const view = (
    <DataIntegrityView
      state={state}
      isRefreshing={integrityQuery.isFetching && !integrityQuery.isPending}
      onRetry={() => { void integrityQuery.refetch(); }}
    />
  );

  if (variant === 'embedded') {
    return view;
  }

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="سلامة البيانات"
        description={`فحص قراءة فقط للعلاقات الأساسية في مخطط ${APP_BRAND_NAME} الحالي. لا ينفذ أي تغييرات على البيانات.`}
      />
      {view}
    </PageLayout>
  );
}

/** Standalone /data-integrity route entry point — preserves historical behavior exactly. */
export function DataIntegrityPage() {
  return <DataIntegrityWorkspace variant="standalone" />;
}
