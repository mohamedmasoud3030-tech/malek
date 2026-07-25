import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { DataIntegrityView } from './components/data-integrity-view';
import { runDataIntegrityAudit } from './services/data-integrity-service';

export function DataIntegrityPage() {
  const { authorization } = useAuth();
  const integrityQuery = useQuery({ queryKey: ['data-integrity-audit'], queryFn: runDataIntegrityAudit, enabled: canAccess(authorization, 'integrity.view') });

  if (!canAccess(authorization, 'integrity.view')) {
    return <AccessDenied message="فحوصات سلامة البيانات متاحة فقط للمدير أو المسؤول." />;
  }

  const state = integrityQuery.isPending
    ? ({ status: 'loading' } as const)
    : integrityQuery.isError
      ? ({ status: 'error', error: integrityQuery.error } as const)
      : ({ status: 'ready', result: integrityQuery.data } as const);

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="سلامة البيانات"
        description="فحص قراءة فقط للعلاقات الأساسية في مخطط Rentrix الحالي. لا ينفذ أي تغييرات على البيانات."
      />
      <DataIntegrityView state={state} />
    </PageLayout>
  );
}

