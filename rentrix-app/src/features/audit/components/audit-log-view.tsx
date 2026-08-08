import { Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { MobileCard } from '@/components/ui/mobile-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { AuditLogRecord, AuditLogResult } from '../types';

export type AuditLogViewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; error: unknown }>
  | Readonly<{ status: 'ready'; result: AuditLogResult }>;

function formatAuditDate(settings: CompanySettingsContract, value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatCompanyDateTime(settings, date);
}

export function AuditLogView({ state }: Readonly<{ state: AuditLogViewState }>) {
  const companySettings = useCompanySettingsContract();
  if (state.status === 'loading') return <RouteLoadingState />;
  if (state.status === 'error') {
    return <DataErrorScreen title="تعذر تحميل سجل التدقيق" fallbackMessage="يمكن إعادة المحاولة لاحقاً دون تغيير أي بيانات." error={state.error} />;
  }
  if (state.result.status === 'unavailable') {
    return <EmptyState title="سجل التدقيق غير متاح بأمان" description={state.result.reason} role="alert" ariaLive="assertive" />;
  }

  const records = state.result.records;
  if (records.length === 0) {
    return (
      <EmptyState
        title="لا توجد أحداث تدقيق"
        description="لم يرجع مصدر سجل التدقيق أي أحداث للعرض."
        action={<Button asChild><Link to="/dashboard">العودة إلى لوحة التحكم</Link></Button>}
      />
    );
  }

  const columns: ColumnDef<AuditLogRecord>[] = [
    { key: 'time', header: 'الوقت', render: (record) => <span className="font-bold">{formatAuditDate(companySettings, record.occurredAt)}</span> },
    { key: 'actor', header: 'المستخدم', render: (record) => record.actor },
    { key: 'action', header: 'الإجراء', render: (record) => <StatusBadge tone="info">{record.action}</StatusBadge> },
    { key: 'scope', header: 'النطاق', render: (record) => record.entityType || 'عام' },
    { key: 'description', header: 'الوصف', render: (record) => <span className="max-w-lg whitespace-normal text-muted-foreground">{record.description ?? 'لا يوجد وصف'}</span> },
  ];

  return (
    <EntityTable
      aria-label="جدول سجل التدقيق"
      rows={records}
      columns={columns}
      keyOf={(record) => record.id}
      emptyTitle="لا توجد أحداث تدقيق"
      emptyDescription="لا توجد أحداث للعرض."
      enableViewModeToggle
      viewModeStorageKey="rentrix:view-mode:audit-log"
      renderMobileCard={(record) => (
        <MobileCard
          title={record.action}
          subtitle={`${record.actor} · ${record.entityType || 'عام'}`}
          badge={<StatusBadge tone="info">تدقيق</StatusBadge>}
          meta={(
            <div className="space-y-2 text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="size-3.5" />{formatAuditDate(companySettings, record.occurredAt)}</p>
              {record.description ? <p className="leading-5 text-muted-foreground">{record.description}</p> : null}
            </div>
          )}
        />
      )}
    />
  );
}
