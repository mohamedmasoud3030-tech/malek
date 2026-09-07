import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { AsyncContentState } from '@/components/async-content-state';
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/state-surfaces';
import { Button } from '@/components/ui/button';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { AuditLogRecord, AuditLogResult } from '../types';

export type AuditLogViewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'ready'; result: AuditLogResult; refreshError?: unknown }>;

type AuditLogViewProps = Readonly<{
  state: AuditLogViewState;
  onRetry?: () => void;
  isRefreshing?: boolean;
}>;

function formatAuditDate(settings: CompanySettingsContract, value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatCompanyDateTime(settings, date);
}

export function AuditLogView({ state, onRetry, isRefreshing = false }: AuditLogViewProps) {
  const companySettings = useCompanySettingsContract();
  const retryAction = onRetry ? <Button variant="secondary" size="sm" loading={isRefreshing} onClick={onRetry}>إعادة المحاولة</Button> : undefined;

  const columns = useMemo((): ColumnDef<AuditLogRecord>[] => [
    { key: 'time', priority: 'identity' as const, header: 'الوقت', render: (record) => <span className="font-bold">{formatAuditDate(companySettings, record.occurredAt)}</span> },
    { key: 'actor', priority: 'secondary' as const, header: 'المستخدم', render: (record) => record.actor },
    { key: 'action', priority: 'primary' as const, header: 'الإجراء', render: (record) => <StatusBadge tone="info">{record.action}</StatusBadge> },
    { key: 'scope', priority: 'secondary' as const, header: 'النطاق', render: (record) => record.entityType || 'عام' },
    { key: 'description', priority: 'detail' as const, header: 'الوصف', render: (record) => <span className="max-w-lg whitespace-normal text-muted-foreground">{record.description ?? 'لا يوجد وصف'}</span> },
  ], []);

  if (state.status === 'ready' && state.result.status === 'unavailable') {
    return <EmptyState title="سجل التدقيق غير متاح بأمان" description={state.result.reason} role="alert" ariaLive="assertive" action={retryAction} />;
  }

  const records = state.status === 'ready' && state.result.status === 'available' ? state.result.records : [];

  return (
    <AsyncContentState
      status={state.status === 'loading' ? 'loading' : state.status === 'error' ? 'error' : records.length === 0 ? 'empty' : 'ready'}
      error={state.status === 'error' ? state.error : undefined}
      errorTitle="تعذر تحميل سجل التدقيق"
      errorFallbackMessage="يمكن إعادة المحاولة لاحقاً دون تغيير أي بيانات."
      errorAction={retryAction}
      emptyTitle="لا توجد أحداث تدقيق"
      emptyDescription="لم يرجع مصدر سجل التدقيق أي أحداث للعرض ضمن الفترة الحالية. يمكنك العودة لاحقاً بعد تسجيل المزيد من الأحداث."
      emptyAction={<Button asChild><Link to="/dashboard">العودة إلى لوحة التحكم</Link></Button>}
    >
      <div className="space-y-4">
        {state.status === 'ready' && state.refreshError ? <DataRefreshAlert onRetry={onRetry} isRefreshing={isRefreshing} /> : null}
        {state.status === 'ready' && state.result.status === 'available' && state.result.truncated ? (
          <Alert
            variant="info"
            title="يُعرض أحدث 200 حدث"
            description="توجد أحداث أقدم خارج هذه القراءة المحدودة. لا تعتبر القائمة المعروضة سجلاً تاريخياً كاملاً."
          />
        ) : null}
        <EntityTable
          aria-label="جدول سجل التدقيق"
          rows={[...records]}
          columns={columns}
          keyOf={(record) => record.id}
          emptyTitle="لا توجد أحداث تدقيق"
          emptyDescription="لا توجد أحداث للعرض حالياً — يمكنك العودة لاحقاً بعد تسجيل المزيد من الأحداث."
        />
      </div>
    </AsyncContentState>
  );
}
