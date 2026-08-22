import { AlertTriangle, CheckCircle2, RefreshCcw, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ReconciliationRow } from '@/features/accounting/wp05Services';
import {
  summarizeReconciliationReadiness,
  useSubledgerGlReconciliation,
} from '../../accounting-report-authority';

const columns: ColumnDef<ReconciliationRow>[] = [
  {
    key: 'class',
    header: 'المطابقة',
    priority: 'identity',
    render: (row) => (
      <div>
        <p className="font-bold">{row.reconciliation_class || 'مطابقة مالية'}</p>
        <p className="text-xs text-muted-foreground">{row.account_no} — {row.account_name}</p>
      </div>
    ),
  },
  {
    key: 'subledger',
    header: 'الدفتر المساعد',
    priority: 'primary',
    render: (row) => <span dir="ltr" className="tabular-nums">{formatMoney(row.subledger_balance)}</span>,
  },
  {
    key: 'gl',
    header: 'الأستاذ العام',
    priority: 'secondary',
    render: (row) => <span dir="ltr" className="tabular-nums">{formatMoney(row.gl_balance)}</span>,
  },
  {
    key: 'variance',
    header: 'الفرق',
    priority: 'secondary',
    render: (row) => (
      <span dir="ltr" className={row.abs_variance > 0.001 ? 'font-bold text-destructive tabular-nums' : 'tabular-nums'}>
        {formatMoney(row.variance)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'الحالة',
    priority: 'actions',
    render: (row) => (
      <StatusBadge tone={row.reconciliation_status === 'PASS' && row.abs_variance <= 0.001 ? 'green' : 'danger'}>
        {row.reconciliation_status === 'PASS' && row.abs_variance <= 0.001 ? 'مطابق' : 'فرق يحتاج معالجة'}
      </StatusBadge>
    ),
  },
];

export function AccountingReconciliationReadiness({ asOf }: Readonly<{ asOf: string }>) {
  const query = useSubledgerGlReconciliation(asOf);
  const rows = query.data ?? [];
  const readiness = summarizeReconciliationReadiness(rows);

  if (query.isLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  if (query.isError) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-5" />
            تعذر التحقق من مطابقة الدفاتر
          </CardTitle>
          <CardDescription>
            لم يتم إثبات مطابقة الدفاتر المساعدة مع الأستاذ العام حتى {asOf}. لا تعتبر القوائم «جاهزة» حتى ينجح هذا الفحص.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>
            <RefreshCcw className="me-2 size-4" />
            إعادة التحقق
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (readiness.state === 'NO_EVIDENCE') {
    return (
      <Card className="border-warning/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-5 text-warning" />
            لا توجد أدلة مطابقة كافية
          </CardTitle>
          <CardDescription>
            محرك المطابقة لم يُرجع صفوفًا حتى {asOf}. صفر صفوف لا يُعامل كنجاح؛ تحقق من تهيئة الحسابات والدفاتر المساعدة قبل الاعتماد على القوائم.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={readiness.state === 'PASS' ? 'border-success/30' : 'border-destructive/30'}>
      <CardHeader className="border-b border-border/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              {readiness.state === 'PASS' ? <CheckCircle2 className="size-5 text-success" /> : <AlertTriangle className="size-5 text-destructive" />}
              مطابقة الدفاتر المساعدة ↔ الأستاذ العام
            </CardTitle>
            <CardDescription className="mt-1">
              فحص محاسبي authoritative حتى {asOf}. القوائم أدناه مبنية على الأستاذ العام؛ هذه المطابقة تكشف أي فرق بين المصدر التشغيلي والـGL.
            </CardDescription>
          </div>
          <StatusBadge tone={readiness.state === 'PASS' ? 'green' : 'danger'}>
            {readiness.state === 'PASS' ? `مطابق — ${readiness.total} فحوص` : `${readiness.failed} من ${readiness.total} بها فروقات`}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <EntityTable<ReconciliationRow>
          aria-label="مطابقة الدفاتر المساعدة مع الأستاذ العام"
          rows={rows}
          keyOf={(row) => `${row.reconciliation_class}:${row.account_no}`}
          columns={columns}
          emptyTitle="لا توجد أدلة مطابقة"
          emptyDescription="تحقق من تهيئة الحسابات والدفاتر المساعدة ثم أعد الفحص."
        />
        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span>أقصى فرق مطلق: <strong dir="ltr">{formatMoney(readiness.maxAbsVariance)}</strong></span>
          <Button type="button" variant="ghost" size="sm" onClick={() => query.refetch()}>
            <RefreshCcw className="me-2 size-3.5" />
            تحديث المطابقة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
