import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { AuditLogView } from './components/audit-log-view';
import { fetchAuditLog } from './services/audit-log-service';

export function AuditLogPage() {
  const { authorization } = useAuth();
  const auditLogQuery = useQuery({ queryKey: ['audit-log'], queryFn: fetchAuditLog, enabled: canAccess(authorization, 'audit.view') });

  if (!canAccess(authorization, 'audit.view')) {
    return <AccessDenied message="عرض سجل التدقيق متاح فقط للمدير أو المسؤول." />;
  }

  const state = auditLogQuery.isPending
    ? ({ status: 'loading' } as const)
    : auditLogQuery.isError
      ? ({ status: 'error', error: auditLogQuery.error } as const)
      : ({ status: 'ready', result: auditLogQuery.data } as const);

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

