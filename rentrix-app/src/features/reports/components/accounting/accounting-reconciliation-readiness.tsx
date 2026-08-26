import { AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ReconciliationRow } from '@/features/accounting/wp05Services';
import type { ReconciliationReadiness } from '../../accounting-report-authority';

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

type Props = Readonly<{
  asOf: string;
  rows: readonly ReconciliationRow[];
  readiness: ReconciliationReadiness;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
}>;

export function AccountingReconciliationReadiness({
  asOf,
  rows,
  readiness,
  isLoading,
  isError,
  onRefetch,
}: Props) {
  if (isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="size-5" aria-hidden="true" />
            تعذر التحقق من مطابقة الدفاتر
          </CardTitle>
          <CardDescription>
            لم يتم إثبات مطابقة الدفاتر المساعدة مع الأستاذ العام حتى {asOf}. لا تعتبر القوائم جاهزة حتى ينجح هذا الفحص.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRefetch}>
            <RefreshCcw className="me-2 size-4" aria-hidden="true" />
            إعادة التحقق
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (readiness.state === 'NO_EVIDENCE') {
    return (
      <Card className="border-warning/30">
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
            لا توجد أدلة مطابقة كافية
          </CardTitle>
          <CardDescription>
            محرك المطابقة لم يُرجع صفوفًا حتى {asOf}. صفر صفوف لا يُعامل كنجاح، لذلك تظل المخرجات المحاسبية غير جاهزة للاعتماد.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isPass = readiness.state === 'PASS';
  const evidenceTable = (
    <>
      <EntityTable<ReconciliationRow>
        aria-label="مطابقة الدفاتر المساعدة مع الأستاذ العام"
        rows={[...rows]}
        keyOf={(row) => `${row.reconciliation_class}:${row.account_no}`}
        columns={columns}
        emptyTitle="لا توجد أدلة مطابقة"
        emptyDescription="تحقق من تهيئة الحسابات والدفاتر المساعدة ثم أعد الفحص."
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
        <span>أقصى فرق مطلق: <strong dir="ltr">{formatMoney(readiness.maxAbsVariance)}</strong></span>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={onRefetch}>
          <RefreshCcw className="me-2 size-3.5" aria-hidden="true" />
          تحديث المطابقة
        </Button>
      </div>
    </>
  );

  return (
    <Card className={isPass ? 'border-success/30' : 'border-destructive/30'}>
      <CardHeader className="p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              {isPass ? (
                <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
              )}
              مطابقة الدفاتر المساعدة ↔ الأستاذ العام
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              فحص حتى {asOf}. القوائم مبنية على الأستاذ العام، والمطابقة تكشف أي فرق مع المصادر التشغيلية.
              {readiness.missingAccountNos.length > 0 ? (
                <span className="mt-1 block font-semibold text-destructive">
                  حسابات مطابقة مفقودة: {readiness.missingAccountNos.join('، ')}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <StatusBadge tone={isPass ? 'green' : 'danger'}>
            {isPass ? `مطابق — ${readiness.total} فحوص` : `${readiness.failed} من ${readiness.total} غير جاهز`}
          </StatusBadge>
        </div>
      </CardHeader>

      <CardContent className="border-t border-border/60 p-0">
        {isPass ? (
          <details>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-black text-foreground hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20 sm:px-4">
              <span>تفاصيل أدلة المطابقة</span>
              <span className="font-semibold text-muted-foreground">{readiness.total} فحوص ناجحة</span>
            </summary>
            <div className="border-t border-border/50">{evidenceTable}</div>
          </details>
        ) : (
          evidenceTable
        )}
      </CardContent>
    </Card>
  );
}
