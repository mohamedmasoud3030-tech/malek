import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
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

  if (integrityQuery.isPending) return <DataIntegrityView state={{ status: 'loading' }} />;
  if (integrityQuery.isError) return <DataIntegrityView state={{ status: 'error', error: integrityQuery.error }} />;

  return <DataIntegrityView state={{ status: 'ready', result: integrityQuery.data }} />;
}

