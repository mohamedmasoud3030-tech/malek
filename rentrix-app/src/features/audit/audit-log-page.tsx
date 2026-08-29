import { useQuery } from '@tanstack/react-query';
import { AccessDenied } from '@/components/layout/access-denied';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { useActiveCompanyId } from '@/hooks/use-company';
import { AuditLogView } from './components/audit-log-view';
import { fetchAuditLog } from './services/audit-log-service';
import type { AuditLogResult } from './types';

export function getAuditLogViewState(query: { isPending: boolean; isError: boolean; error: unknown; data: AuditLogResult | undefined }) {
  if (query.isPending) return { status: 'loading' } as const;
  if (query.data !== undefined) {
    return { status: 'ready', result: query.data, refreshError: query.isError ? query.error : null } as const;
  }
  if (query.isError) return { status: 'error', error: query.error } as const;
  return { status: 'error', error: new Error('AUDIT_LOG_RESULT_MISSING') } as const;
}

export type AuditLogWorkspaceVariant = 'standalone' | 'embedded';

type AuditLogWorkspaceProps = Readonly<{
  /**
   * 'standalone' (default) preserves the historical /audit-log route:
   * content renders inside its own PageLayout + PageHeader. 'embedded'
   * drops both so the content can be hosted inside the governance hub
   * without duplicating page chrome.
   */
  variant?: AuditLogWorkspaceVariant;
}>;

export function AuditLogWorkspace({ variant = 'standalone' }: AuditLogWorkspaceProps = {}) {
  const { authorization } = useAuth();
  const activeCompanyId = useActiveCompanyId();
  const hasAccess = canAccess(authorization, 'audit.view');
  const auditLogQuery = useQuery({
    queryKey: ['audit-log', activeCompanyId],
    queryFn: fetchAuditLog,
    enabled: hasAccess && Boolean(activeCompanyId),
  });

  if (!hasAccess) {
    return <AccessDenied message="عرض سجل التدقيق متاح فقط للمدير أو المسؤول." />;
  }

  const state = getAuditLogViewState(auditLogQuery);
  const view = (
    <AuditLogView
      state={state}
      isRefreshing={auditLogQuery.isFetching && !auditLogQuery.isPending}
      onRetry={() => { void auditLogQuery.refetch(); }}
    />
  );

  if (variant === 'embedded') {
    return view;
  }

  return (
    <PageLayout dir="rtl" lang="ar" visualVariant="malek-pro">
      <PageHeader
        title="سجل التدقيق"
        description="عرض قراءة فقط لأحداث الحوكمة المتاحة من مصدر التدقيق الحالي دون تعديل أي سجل."
      />
      {view}
    </PageLayout>
  );
}

/** Standalone /audit-log route entry point — preserves historical behavior exactly. */
export function AuditLogPage() {
  return <AuditLogWorkspace variant="standalone" />;
}

