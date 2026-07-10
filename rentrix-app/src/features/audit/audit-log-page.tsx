import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
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

  if (auditLogQuery.isPending) return <AuditLogView state={{ status: 'loading' }} />;
  if (auditLogQuery.isError) return <AuditLogView state={{ status: 'error', error: auditLogQuery.error }} />;

  return <AuditLogView state={{ status: 'ready', result: auditLogQuery.data }} />;
}

