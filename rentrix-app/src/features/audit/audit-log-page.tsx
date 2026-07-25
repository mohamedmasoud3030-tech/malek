import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { AuditLogView } from './components/audit-log-view';
import { fetchAuditLog } from './services/audit-log-service';

function getAuditLogViewState(query: { isPending: boolean; isError: boolean; error: unknown; data: any }) {
  if (query.isPending) return { status: 'loading' } as const;
  if (query.isError) return { status: 'error', error: query.error } as const;
  return { status: 'ready', result: query.data } as const;
}

export function AuditLogPage() {
  const { authorization } = useAuth();
  const auditLogQuery = useQuery({ queryKey: ['audit-log'], queryFn: fetchAuditLog, enabled: canAccess(authorization, 'audit.view') });

  if (!canAccess(authorization, 'audit.view')) {
    return <AccessDenied message="عرض سجل التدقيق متاح فقط للمدير أو المسؤول." />;
  }

  const state = getAuditLogViewState(auditLogQuery);

  return (
    <PageLayout dir="rtl" lang="ar">
      <PageHeader
        title="سجل التدقيق"
        description="عرض قراءة فقط لأحداث الحوكمة المتاحة من مصدر التدقيق الحالي دون تعديل أي سجل."
      />
      <AuditLogView state={state} />
    </PageLayout>
  );
}

