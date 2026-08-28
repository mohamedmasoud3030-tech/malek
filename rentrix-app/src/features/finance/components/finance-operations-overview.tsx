import { Link } from '@tanstack/react-router';
import type { ComponentType } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  FileSpreadsheet,
  HandCoins,
  ReceiptText,
  TrendingDown,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FinanceReadinessSection } from '@/features/financials/tax-authority/finance-readiness-section';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import type { ArrearsSummaryReport, CollectionSummaryReport } from '@/features/financials/reports/financialReportsService';
import { cn } from '@/lib/utils';
import { getFinanceCockpitState } from '../finance-cockpit-state';

type FinanceOperationsOverviewProps = Readonly<{
  summary: CollectionSummaryReport | undefined;
  arrears: ArrearsSummaryReport | undefined;
  isLoading: boolean;
  isError: boolean;
  canViewArrears: boolean;
  canViewExpenses: boolean;
  canViewManagementFees: boolean;
  canViewOwnerSettlements: boolean;
  onOpenCollections: () => void;
  onOpenReceipts: () => void;
  onOpenArrears: () => void;
  onOpenExpenses: () => void;
  onOpenManagementFees: () => void;
  onOpenOwnerSettlements: () => void;
}>;

type QueueCardProps = Readonly<{
  title: string;
  value: string;
  description: string;
  actionLabel: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  icon: ComponentType<{ className?: string }>;
  onAction: () => void;
  isLoading: boolean;
}>;

function QueueCard({ title, value, description, actionLabel, tone, icon: Icon, onAction, isLoading }: QueueCardProps) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border/65 bg-background p-3.5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl',
          tone === 'success' && 'bg-success/10 text-success',
          tone === 'warning' && 'bg-warning/10 text-warning',
          tone === 'danger' && 'bg-destructive/10 text-destructive',
          tone === 'neutral' && 'bg-muted text-muted-foreground',
        )}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className={cn(
          'rounded-full px-2 py-1 text-[10px] font-black',
          tone === 'success' && 'bg-success/10 text-success',
          tone === 'warning' && 'bg-warning/10 text-warning',
          tone === 'danger' && 'bg-destructive/10 text-destructive',
          tone === 'neutral' && 'bg-muted text-muted-foreground',
        )}>
          {title}
        </span>
      </div>
      <div className="mt-3 min-h-8 truncate text-xl font-black tabular-nums">
        {isLoading ? <Skeleton className="h-7 w-28" /> : value}
      </div>
      <p className="mt-1 min-h-10 text-xs font-semibold leading-5 text-muted-foreground">{description}</p>
      <Button type="button" variant="ghost" size="sm" className="mt-3 min-h-11 justify-between px-2" onClick={onAction}>
        {actionLabel}
        <ArrowLeft className="size-4" aria-hidden="true" />
      </Button>
    </article>
  );
}

export function FinanceOperationsOverview({
  summary,
  arrears,
  isLoading,
  isError,
  canViewArrears,
  canViewExpenses,
  canViewManagementFees,
  canViewOwnerSettlements,
  onOpenCollections,
  onOpenReceipts,
  onOpenArrears,
  onOpenExpenses,
  onOpenManagementFees,
  onOpenOwnerSettlements,
}: FinanceOperationsOverviewProps) {
  const state = getFinanceCockpitState(summary, arrears);
  const overdue = arrears?.totalOverdue ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const expenses = summary?.expensesTotal ?? 0;
  const nextActionIsArrears = state.nextAction === 'arrears' && canViewArrears;

  return (
    <div className="space-y-4 sm:space-y-5" data-finance-operations-overview>
      <section className="overflow-hidden rounded-2xl border border-border/65 bg-muted/[0.16]" aria-labelledby="finance-today-heading">
        <header className="flex flex-col gap-3 border-b border-border/55 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black text-primary">قائمة العمل</p>
            <h3 id="finance-today-heading" className="mt-0.5 text-base font-black">ابدأ بالأكثر تأثيرًا اليوم</h3>
          </div>
          <Button type="button" size="sm" onClick={nextActionIsArrears ? onOpenArrears : onOpenCollections} className="min-h-11">
            {nextActionIsArrears ? 'مراجعة المتأخرات' : 'فتح التحصيل'}
            <ArrowLeft className="ms-2 size-4" aria-hidden="true" />
          </Button>
        </header>

        {isError ? (
          <div role="alert" className="mx-3 mt-3 rounded-xl border border-destructive/25 bg-destructive/[0.05] px-3 py-2 text-xs font-bold text-destructive sm:mx-4">
            تعذر تحديث قائمة العمل المالية. لم يتم استبدال البيانات المفقودة بأرقام صفرية.
          </div>
        ) : null}

        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          <QueueCard
            title={isError ? 'غير متاح' : outstanding > 0 ? 'قيد التحصيل' : 'مكتمل'}
            value={isError ? '—' : formatMoney(outstanding)}
            description={isError ? 'تعذر تحميل حركة التحصيل الآن.' : `${summary?.invoicesCount ?? 0} فاتورة في نطاق الشهر، ونسبة التحصيل ${state.collectionRate}%.`}
            actionLabel={outstanding > 0 ? 'استكمال التحصيل' : 'مراجعة الفواتير'}
            tone={isError ? 'neutral' : outstanding > 0 ? 'warning' : 'success'}
            icon={outstanding > 0 ? TrendingDown : CheckCircle2}
            onAction={onOpenCollections}
            isLoading={isLoading}
          />
          <QueueCard
            title={isError ? 'غير متاح' : canViewArrears ? overdue > 0 ? 'تدخل مطلوب' : 'لا متأخرات' : 'مقيّد'}
            value={isError ? '—' : canViewArrears ? formatMoney(overdue) : 'حسب الصلاحية'}
            description={isError
              ? 'تعذر تحميل حالة المتأخرات الآن.'
              : canViewArrears
              ? `${arrears?.overdueInvoiceCount ?? 0} فاتورة متأخرة، منها ${arrears?.over90InvoiceCount ?? 0} تجاوزت 90 يومًا.`
              : 'تفاصيل المتأخرات تظهر فقط للمستخدم المخوّل.'}
            actionLabel={canViewArrears ? 'فتح سجل المتأخرات' : 'فتح التحصيل'}
            tone={isError ? 'neutral' : canViewArrears ? overdue > 0 ? 'danger' : 'success' : 'neutral'}
            icon={AlertTriangle}
            onAction={canViewArrears ? onOpenArrears : onOpenCollections}
            isLoading={isLoading}
          />
          <QueueCard
            title={isError ? 'غير متاح' : canViewExpenses ? expenses > 0 ? 'حركة مسجلة' : 'بدون حركة' : 'مقيّد'}
            value={isError ? '—' : canViewExpenses ? formatMoney(expenses) : 'حسب الصلاحية'}
            description={isError
              ? 'تعذر تحميل حركة المصروفات الآن.'
              : canViewExpenses
                ? 'إجمالي المصروفات المسجلة خلال نطاق الشهر الحالي؛ راجع المستندات والاعتماد من مساحة المصروفات.'
                : 'تفاصيل المصروفات تظهر فقط للمستخدم المخوّل.'}
            actionLabel={canViewExpenses ? 'مراجعة المصروفات' : 'فتح التحصيل'}
            tone={isError ? 'neutral' : canViewExpenses ? expenses > 0 ? 'neutral' : 'success' : 'neutral'}
            icon={WalletCards}
            onAction={canViewExpenses ? onOpenExpenses : onOpenCollections}
            isLoading={isLoading}
          />
        </div>
      </section>

      <section className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
        state.attentionTone === 'danger' && 'border-destructive/25 bg-destructive/[0.04]',
        state.attentionTone === 'warning' && 'border-warning/25 bg-warning/[0.05]',
        state.attentionTone === 'success' && 'border-success/25 bg-success/[0.04]',
      )} aria-label="الإجراء المالي التالي">
        <div className="flex items-start gap-3">
          <span className={cn(
            'mt-1 grid size-8 shrink-0 place-items-center rounded-xl',
            state.attentionTone === 'danger' && 'bg-destructive/10 text-destructive',
            state.attentionTone === 'warning' && 'bg-warning/10 text-warning',
            state.attentionTone === 'success' && 'bg-success/10 text-success',
          )}>
            <ReceiptText className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-black text-muted-foreground">الإجراء التالي</p>
            <p className="mt-0.5 text-sm font-black">{isError ? 'راجع مساحة التحصيل مباشرة' : state.nextActionLabel}</p>
            <p className="text-xs font-semibold text-muted-foreground">
              {isError ? 'قائمة الأولويات غير متاحة حتى تنجح إعادة تحميل البيانات.' : state.attentionDetail}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onOpenReceipts}>
            <ReceiptText className="me-1.5 size-4" aria-hidden="true" />
            تسجيل تحصيل
          </Button>
          <Button variant="ghost" size="sm" asChild className="min-h-11">
            <Link to="/reports">
              <FileSpreadsheet className="me-1.5 size-4" aria-hidden="true" />
              الرقابة والتقارير
            </Link>
          </Button>
        </div>
      </section>

      {canViewManagementFees || canViewOwnerSettlements ? (
        <section className="rounded-2xl border border-border/65 bg-muted/[0.10] px-4 py-3.5" aria-labelledby="finance-admin-considerations-heading">
          <div>
            <p className="text-[11px] font-black text-primary">اعتبارات التشغيل</p>
            <h3 id="finance-admin-considerations-heading" className="mt-0.5 text-base font-black">أتعاب الإدارة ومستحقات الملاك</h3>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              مهام دورية يحرص عليها المكتب شهريًا: احتساب أتعاب الإدارة وفق الاتفاقيات، وتجهيز تسويات الملاك للصرف.
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {canViewManagementFees ? (
              <button
                type="button"
                onClick={onOpenManagementFees}
                className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border/65 bg-background px-3.5 py-3 text-start transition-colors hover:border-primary/45"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BadgeDollarSign className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">استحقاق أتعاب الإدارة الشهرية</span>
                    <span className="block truncate text-xs font-semibold text-muted-foreground">احتساب الاستحقاقات للفترة وفق الاتفاقيات السارية، مع سجل معتمد قابل للعكس.</span>
                  </span>
                </span>
                <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              </button>
            ) : null}
            {canViewOwnerSettlements ? (
              <button
                type="button"
                onClick={onOpenOwnerSettlements}
                className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border/65 bg-background px-3.5 py-3 text-start transition-colors hover:border-primary/45"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
                    <HandCoins className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black">مستحقات وتسويات الملاك</span>
                    <span className="block truncate text-xs font-semibold text-muted-foreground">صافي مستحق كل مالك بعد أتعاب الإدارة والمصروفات، وتسويات الصرف المعتمدة.</span>
                  </span>
                </span>
                <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="finance-readiness-heading" className="space-y-3">
        <div className="px-1">
          <p className="text-[11px] font-black text-primary">سلامة التشغيل</p>
          <h3 id="finance-readiness-heading" className="mt-0.5 text-base font-black">جاهزية المعالجة والضريبة</h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">تفاصيل الإعداد تظهر هنا بعد أولويات التحصيل، وليست بديلًا عن قائمة العمل اليومية.</p>
        </div>
        <FinanceReadinessSection />
      </section>
    </div>
  );
}
