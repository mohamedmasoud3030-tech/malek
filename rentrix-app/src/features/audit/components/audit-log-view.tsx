import { Link } from '@tanstack/react-router';
import { ShieldCheck } from 'lucide-react';
import { DataErrorScreen } from '@/components/data-error-screen';
import { EmptyState } from '@/components/empty-state';
import { RouteLoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyDateTime } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import type { AuditLogResult } from '../types';

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

  if (state.result.records.length === 0) {
    return (
      <EmptyState
        title="لا توجد أحداث تدقيق"
        description="لم يرجع مصدر سجل التدقيق أي أحداث للعرض."
        action={
          <Button asChild>
            <Link to="/dashboard">العودة إلى لوحة التحكم</Link>
          </Button>
        }
      />
    );
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />سجل التدقيق</CardTitle>
          <CardDescription>عرض قراءة فقط لأحداث الحوكمة المتاحة من مصدر التدقيق الحالي.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {state.result.records.map((record) => (
              <div key={record.id} className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{record.action}</span>
                  <span className="text-xs text-muted-foreground">{formatAuditDate(companySettings, record.occurredAt)}</span>
                </div>
                <p className="text-sm font-bold">{record.actor}</p>
                <p className="text-xs text-muted-foreground">{record.entityType}{record.entityId ? ` / ${record.entityId}` : ''}</p>
                {record.description ? <p className="text-xs text-muted-foreground">{record.description}</p> : null}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right font-black">الوقت</th>
                  <th className="px-4 py-3 text-right font-black">المستخدم</th>
                  <th className="px-4 py-3 text-right font-black">الإجراء</th>
                  <th className="px-4 py-3 text-right font-black">النطاق</th>
                  <th className="px-4 py-3 text-right font-black">الوصف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {state.result.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 font-bold">{formatAuditDate(companySettings, record.occurredAt)}</td>
                    <td className="px-4 py-3">{record.actor}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">{record.action}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{record.entityType}{record.entityId ? ` / ${record.entityId}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{record.description ?? 'لا يوجد وصف'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

