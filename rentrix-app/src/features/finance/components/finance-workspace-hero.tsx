import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Gauge,
  ReceiptText,
  TrendingDown,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ArrearsSummaryReport, CollectionSummaryReport } from '@/features/financials/reports/financialReportsService';
import { cn } from '@/lib/utils';

type FinanceWorkspaceHeroProps = Readonly<{
  summary: CollectionSummaryReport | undefined;
  arrears: ArrearsSummaryReport | undefined;
  isLoading: boolean;
  isError: boolean;
  canViewArrears: boolean;
  onOpenCollections: () => void;
  onOpenArrears: () => void;
}>;

export type FinanceCockpitState = Readonly<{
  collectionRate: number;
  attentionLabel: string;
  attentionDetail: string;
  attentionTone: 'danger' | 'warning' | 'success';
  nextActionLabel: string;
  nextAction: 'arrears' | 'collections';
}>;

export function getFinanceCockpitState(
  summary: CollectionSummaryReport | undefined,
  arrears: ArrearsSummaryReport | undefined,
): FinanceCockpitState {
  const invoiced = Math.max(summary?.invoiced ?? 0, 0);
  const paid = Math.max(summary?.paid ?? 0, 0);
  const outstanding = Math.max(summary?.outstanding ?? 0, 0);
  const overdue = Math.max(arrears?.totalOverdue ?? 0, 0);
  const collectionRate = invoiced > 0 ? Math.min(Math.round((paid / invoiced) * 100), 100) : 0;

  if (overdue > 0) {
    return {
      collectionRate,
      attentionLabel: 'متأخرات تحتاج تدخلاً',
      attentionDetail: `${arrears?.overdueInvoiceCount ?? 0} فاتورة تجاوزت موعدها`,
      attentionTone: 'danger',
      nextActionLabel: 'راجع المتأخرات أولاً',
      nextAction: 'arrears',
    };
  }

  if (outstanding > 0) {
    return {
      collectionRate,
      attentionLabel: 'تحصيل غير مكتمل',
      attentionDetail: `${summary?.invoicesCount ?? 0} فاتورة ضمن حركة الشهر`,
      attentionTone: 'warning',
      nextActionLabel: 'استكمل التحصيل',
      nextAction: 'collections',
    };
  }

  return {
    collectionRate,
    attentionLabel: 'لا توجد مبالغ معلّقة',
    attentionDetail: invoiced > 0 ? 'تحصيل الشهر مكتمل' : 'لا توجد فواتير في نطاق الشهر',
    attentionTone: 'success',
    nextActionLabel: 'راجع حركة التحصيل',
    nextAction: 'collections',
  };
}

function Metric({
  label,
  value,
  helper,
  tone = 'default',
  icon,
}: Readonly<{
  label: string;
  value: ReactNode;
  helper: string;
  tone?: 'default' | 'danger' | 'success';
  icon: ReactNode;
}>) {
  return (
    <div className="min-w-0 border-s border-border/60 px-3 first:border-s-0 sm:px-4">
      <div className="flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn(
        'mt-1 min-h-7 truncate text-lg font-black leading-7 tabular-nums sm:text-xl',
        tone === 'danger' && 'text-destructive',
        tone === 'success' && 'text-success',
      )}>
        {value}
      </div>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{helper}</p>
    </div>
  );
}

export function FinanceWorkspaceHero({
  summary,
  arrears,
  isLoading,
  isError,
  canViewArrears,
  onOpenCollections,
  onOpenArrears,
}: FinanceWorkspaceHeroProps) {
  const state = getFinanceCockpitState(summary, arrears);
  const overdue = arrears?.totalOverdue ?? 0;
  const attentionIsActionable = state.nextAction === 'arrears' && canViewArrears;

  return (
    <section
      aria-label="نبض المالية التشغيلي"
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card"
      data-finance-cockpit
      data-finance-state={isError ? 'error' : state.attentionTone}
    >
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Gauge className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-black sm:text-lg">الوضع المالي اليوم</h1>
            <p className="text-[11px] font-semibold text-muted-foreground">أرقام الشهر الحالي وأولوية التدخل الآن</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onOpenCollections} className="min-h-11">
            <ReceiptText className="me-1.5 size-4" aria-hidden="true" />
            التحصيل
          </Button>
          <Button variant="outline" size="sm" asChild className="min-h-11">
            <Link to="/reports">
              <FileSpreadsheet className="me-1.5 size-4" aria-hidden="true" />
              التقارير
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-4 px-1 py-4 lg:grid-cols-4">
        <Metric
          label="المحصّل"
          value={isLoading ? <Skeleton className="h-6 w-24" /> : isError ? '—' : formatMoney(summary?.paid ?? 0)}
          helper={isError ? 'غير متاح الآن' : `${summary?.receiptsCount ?? 0} إيصال هذا الشهر`}
          tone="success"
          icon={<CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />}
        />
        <Metric
          label="المتبقي"
          value={isLoading ? <Skeleton className="h-6 w-24" /> : isError ? '—' : formatMoney(summary?.outstanding ?? 0)}
          helper={isError ? 'غير متاح الآن' : `${summary?.invoicesCount ?? 0} فاتورة في النطاق`}
          icon={<TrendingDown className="size-3.5" aria-hidden="true" />}
        />
        <Metric
          label="المتأخر"
          value={isLoading ? <Skeleton className="h-6 w-24" /> : isError ? '—' : canViewArrears ? formatMoney(overdue) : '—'}
          helper={isError ? 'غير متاح الآن' : canViewArrears ? `${arrears?.overdueInvoiceCount ?? 0} فاتورة متأخرة` : 'حسب صلاحية المتأخرات'}
          tone={overdue > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle className={cn('size-3.5', overdue > 0 && 'text-destructive')} aria-hidden="true" />}
        />
        <Metric
          label="نسبة التحصيل"
          value={isLoading ? <Skeleton className="h-6 w-16" /> : isError ? '—' : `${state.collectionRate}%`}
          helper={isError ? 'غير متاح الآن' : 'من قيمة فواتير الشهر'}
          icon={<Gauge className="size-3.5" aria-hidden="true" />}
        />
      </div>

      <div className={cn(
        'flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5',
        isError && 'border-destructive/20 bg-destructive/[0.045]',
        !isError && state.attentionTone === 'danger' && 'border-destructive/20 bg-destructive/[0.045]',
        !isError && state.attentionTone === 'warning' && 'border-warning/20 bg-warning/[0.05]',
        !isError && state.attentionTone === 'success' && 'border-success/20 bg-success/[0.045]',
      )}>
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn(
            'mt-0.5 size-2.5 shrink-0 rounded-full',
            (isError || state.attentionTone === 'danger') && 'bg-destructive',
            !isError && state.attentionTone === 'warning' && 'bg-warning',
            !isError && state.attentionTone === 'success' && 'bg-success',
          )} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-black">{isError ? 'تعذر تحديث النبض المالي' : state.attentionLabel}</p>
            <p className="text-xs font-semibold text-muted-foreground">
              {isError ? 'البيانات المعروضة غير متاحة الآن؛ افتح مساحة العمل للمحاولة من جديد.' : state.attentionDetail}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 justify-between sm:justify-center"
          onClick={attentionIsActionable ? onOpenArrears : onOpenCollections}
        >
          {attentionIsActionable ? state.nextActionLabel : state.nextAction === 'arrears' ? 'استكمل التحصيل' : state.nextActionLabel}
          <ArrowLeft className="ms-2 size-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
