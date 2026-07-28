import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { APP_BRAND_NAME } from '@/lib/brand';
import { DataIntegrityView } from './components/data-integrity-view';
import { runDataIntegrityAudit } from './services/data-integrity-service';

function getDataIntegrityViewState(query: { isPending: boolean; isError: boolean; error: unknown; data: any }) {
  if (query.isPending) return { status: 'loading' } as const;
  if (query.isError) return { status: 'error', error: query.error } as const;
  return { status: 'ready', result: query.data } as const;
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
  const integrityQuery = useQuery({ queryKey: ['data-integrity-audit'], queryFn: runDataIntegrityAudit, enabled: canAccess(authorization, 'integrity.view') });

  if (!canAccess(authorization, 'integrity.view')) {
    return <AccessDenied message="فحوصات سلامة البيانات متاحة فقط للمدير أو المسؤول." />;
  }

  const state = getDataIntegrityViewState(integrityQuery);

  if (variant === 'embedded') {
    return <DataIntegrityView state={state} />;
  }

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="سلامة البيانات"
        description={`فحص قراءة فقط للعلاقات الأساسية في مخطط ${APP_BRAND_NAME} الحالي. لا ينفذ أي تغييرات على البيانات.`}
      />
      <DataIntegrityView state={state} />
    </PageLayout>
  );
}

/** Standalone /data-integrity route entry point — preserves historical behavior exactly. */
export function DataIntegrityPage() {
  return <DataIntegrityWorkspace variant="standalone" />;
}

