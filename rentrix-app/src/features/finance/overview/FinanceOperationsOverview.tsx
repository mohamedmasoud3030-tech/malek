import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  FileText,
  HandCoins,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { canAccess } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { formatMoney } from '@/features/financials/components/financials-formatters';
import {
  FinanceAlert,
  FinanceKpiCard,
  FinanceKpiGrid,
  FinanceLoadingState,
  FinanceSection,
} from '@/features/financials/components/finance-reporting-visual-foundations';
import {
  useAgedReceivablesReport,
  useArrearsSummaryReport,
  useExpenseTotalsReport,
  useInvoiceTotalsReport,
  usePaymentTotalsReport,
} from '@/features/financials/reports/useFinancialReports';
import {
  listOwnerSettlements,
  summarizeLiveOwnerSettlements,
} from '@/features/owners/services/owner-settlements-service';

const ownerSettlementsQueryKey = ['owner-settlements'] as const;

function FlowStage({
  label,
  hint,
  to,
  search,
}: Readonly<{
  label: string;
  hint: string;
  to: '/financials';
  search: Record<string, string>;
}>) {
  return (
    <Link
      to={to}
      search={search as never}
      className="group min-w-0 rounded-xl border border-border/70 bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <p className="text-xs font-black text-foreground group-hover:text-primary">{label}</p>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-muted-foreground">{hint}</p>
    </Link>
  );
}

function OperationalAttention({
  overdueAmount,
  over90Amount,
  pendingSettlementCount,
  approvedSettlementCount,
  canViewArrears,
  canViewSettlements,
}: Readonly<{
  overdueAmount: number;
  over90Amount: number;
  pendingSettlementCount: number;
  approvedSettlementCount: number;
  canViewArrears: boolean;
  canViewSettlements: boolean;
}>) {
  const hasAttention = (canViewArrears && overdueAmount > 0)
    || (canViewSettlements && (pendingSettlementCount > 0 || approvedSettlementCount > 0));

  if (!hasAttention) {
    return (
      <FinanceAlert
        tone="success"
        title="لا توجد إجراءات مالية حرجة ظاهرة الآن"
        description="لا توجد متأخرات أو تسويات ملاك بانتظار الاعتماد أو الصرف ضمن البيانات التي تملك صلاحية عرضها."
      />
    );
  }

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {canViewArrears && overdueAmount > 0 ? (
        <FinanceAlert
          tone="danger"
          title={`متأخرات تحتاج متابعة · ${formatMoney(overdueAmount)}`}
          description={over90Amount > 0
            ? `منها ${formatMoney(over90Amount)} متأخر لأكثر من 90 يومًا. ابدأ بالأقدم والأعلى تعرضًا.`
            : 'راجع المستأجرين والفواتير المتأخرة وحدد خطوة التحصيل التالية.'}
          action={(
            <Button size="sm" variant="secondary" asChild>
              <Link to="/financials" search={{ section: 'collections', view: 'arrears' } as never}>
                فتح المتأخرات
                <ArrowLeft className="ms-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        />
      ) : null}

      {canViewSettlements && (pendingSettlementCount > 0 || approvedSettlementCount > 0) ? (
        <FinanceAlert
          tone={approvedSettlementCount > 0 ? 'warning' : 'info'}
          title={approvedSettlementCount > 0
            ? `${approvedSettlementCount} تسوية معتمدة جاهزة للصرف`
            : `${pendingSettlementCount} تسوية بانتظار الاعتماد`}
          description={pendingSettlementCount > 0 && approvedSettlementCount > 0
            ? `بالإضافة إلى ${pendingSettlementCount} مسودة/تسوية بانتظار الاعتماد.`
            : 'أكمل الخطوة التالية من دورة تسوية المالك دون إعادة احتساب أي مبلغ في الواجهة.'}
          action={(
            <Button size="sm" variant="secondary" asChild>
              <Link to="/financials" search={{ section: 'funds', view: 'owner_settlements' } as never}>
                فتح تسويات الملاك
                <ArrowLeft className="ms-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}

export function FinanceOperationsOverview() {
  const { authorization } = useAuth();
  const today = getTodayLocalDateString();
  const monthStart = `${today.slice(0, 7)}-01`;
  const periodFilters = useMemo(() => ({ dateFrom: monthStart, dateTo: today }), [monthStart, today]);
  const arrearsFilters = useMemo(() => ({ asOf: today }), [today]);

  const canViewArrears = canAccess(authorization, 'arrears.view');
  const canViewExpenses = canAccess(authorization, 'expenses.view');
  const canViewSettlements = canAccess(authorization, 'financial.owner_settlements.view');

  const invoiceTotals = useInvoiceTotalsReport(periodFilters);
  const paymentTotals = usePaymentTotalsReport(periodFilters);
  const expenseTotals = useExpenseTotalsReport(periodFilters, { enabled: canViewExpenses });
  const agedReceivables = useAgedReceivablesReport(arrearsFilters, { enabled: canViewArrears });
  const arrearsSummary = useArrearsSummaryReport(arrearsFilters, { enabled: canViewArrears });
  const settlementsQuery = useQuery({
    queryKey: ownerSettlementsQueryKey,
    queryFn: listOwnerSettlements,
    enabled: canViewSettlements,
  });

  const settlements = settlementsQuery.data ?? [];
  const settlementTotals = useMemo(() => summarizeLiveOwnerSettlements(settlements), [settlements]);
  const pendingSettlementCount = settlements.filter((settlement) => settlement.status === 'pending').length;
  const approvedSettlementCount = settlements.filter((settlement) => settlement.status === 'approved').length;

  const outstandingAmount = canViewArrears
    ? agedReceivables.data?.totalOutstanding
    : invoiceTotals.data?.totalOutstanding;
  const outstandingLabel = canViewArrears ? 'مستحقات مفتوحة' : 'متبقي فواتير الشهر';
  const outstandingHint = canViewArrears
    ? 'كل الرصيد المفتوح كما في اليوم'
    : 'الفواتير الصادرة من أول الشهر حتى اليوم';

  const isInitialLoading = invoiceTotals.isLoading
    || paymentTotals.isLoading
    || (canViewArrears && agedReceivables.isLoading);

  const hasPrimaryError = invoiceTotals.isError
    || paymentTotals.isError
    || (canViewArrears && (agedReceivables.isError || arrearsSummary.isError));

  return (
    <div className="space-y-4" data-finance-operations-overview>
      <FinanceSection ariaLabel="دورة المال التشغيلية">
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black">دورة المال</p>
              <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                من الاستحقاق حتى تسوية المالك — كل خطوة تفتح مصدرها التشغيلي الحقيقي.
              </p>
            </div>
            <StatusBadge tone="neutral">حتى {today}</StatusBadge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <FlowStage label="1 · الاستحقاق" hint="ما الذي أصبح واجب السداد؟" to="/financials" search={{ section: 'collections', view: 'invoices' }} />
            <FlowStage label="2 · الفاتورة" hint="حالة الفاتورة والمتبقي وموعد السداد." to="/financials" search={{ section: 'collections', view: 'invoices' }} />
            <FlowStage label="3 · التحصيل" hint="الدفعات والإيصالات المنشورة." to="/financials" search={{ section: 'collections', view: 'receipts' }} />
            <FlowStage label="4 · التخصيص" hint="ارتباط التحصيل بالفاتورة والعقد." to="/financials" search={{ section: 'collections', view: 'receipts' }} />
            <FlowStage label="5 · المصروف" hint="المصروف المرتبط بالعقار وسياقه." to="/financials" search={{ section: 'expenses', view: 'expenses' }} />
            <FlowStage label="6 · التسوية" hint="صافي مستحق المالك واعتماده وصرفه." to="/financials" search={{ section: 'funds', view: 'owner_settlements' }} />
          </div>
        </div>
      </FinanceSection>

      {isInitialLoading ? <FinanceLoadingState label="جارٍ تجميع وضع المال التشغيلي..." /> : null}
      {hasPrimaryError ? (
        <FinanceAlert
          tone="warning"
          title="بعض مؤشرات المال لم تُحمّل"
          description="بقية المساحات التشغيلية ما زالت متاحة. افتح السجل المعني لإعادة المحاولة دون تغيير أي بيانات مالية."
        />
      ) : null}

      <FinanceSection ariaLabel="ملخص المال الآن">
        <FinanceKpiGrid desktopColumns={4}>
          <FinanceKpiCard
            label={outstandingLabel}
            value={outstandingAmount === undefined ? '—' : formatMoney(outstandingAmount)}
            sub={outstandingHint}
            icon={CircleDollarSign}
            accent="rose"
            drillTo="/financials"
            drillSearch={canViewArrears
              ? { section: 'collections', view: 'arrears' }
              : { section: 'collections', view: 'invoices' }}
          />
          <FinanceKpiCard
            label="تحصيل الشهر"
            value={paymentTotals.data ? formatMoney(paymentTotals.data.totalPaid) : '—'}
            sub={paymentTotals.data ? `${paymentTotals.data.paymentsCount} دفعة منشورة` : 'من أول الشهر حتى اليوم'}
            icon={ReceiptText}
            accent="emerald"
            drillTo="/financials"
            drillSearch={{ section: 'collections', view: 'receipts' }}
          />
          {canViewArrears ? (
            <FinanceKpiCard
              label="متأخر الآن"
              value={arrearsSummary.data ? formatMoney(arrearsSummary.data.totalOverdue) : '—'}
              sub={arrearsSummary.data ? `${arrearsSummary.data.overdueInvoiceCount} فاتورة متأخرة` : 'بحسب محرك المتأخرات المعتمد'}
              icon={AlertTriangle}
              accent="amber"
              drillTo="/financials"
              drillSearch={{ section: 'collections', view: 'arrears' }}
            />
          ) : null}
          {canViewExpenses ? (
            <FinanceKpiCard
              label="مصروفات الشهر"
              value={expenseTotals.data ? formatMoney(expenseTotals.data.totalExpenses) : '—'}
              sub={expenseTotals.data ? `${expenseTotals.data.expensesCount} مصروف مسجل` : 'من أول الشهر حتى اليوم'}
              icon={WalletCards}
              accent="sky"
              drillTo="/financials"
              drillSearch={{ section: 'expenses', view: 'expenses' }}
            />
          ) : null}
          {canViewSettlements ? (
            <FinanceKpiCard
              label="مستحقات ملاك غير مصروفة"
              value={settlementsQuery.isLoading ? '—' : formatMoney(settlementTotals.outstandingNet)}
              sub="مسودات ومعتمدة فقط؛ المدفوعة والملغاة مستبعدة"
              icon={HandCoins}
              accent="primary"
              drillTo="/financials"
              drillSearch={{ section: 'funds', view: 'owner_settlements' }}
            />
          ) : null}
          <FinanceKpiCard
            label="فواتير الشهر"
            value={invoiceTotals.data ? invoiceTotals.data.invoicesCount : '—'}
            sub={invoiceTotals.data ? `إجمالي ${formatMoney(invoiceTotals.data.totalAmount)}` : 'الفواتير الصادرة في الفترة الحالية'}
            icon={FileText}
            accent="primary"
            drillTo="/financials"
            drillSearch={{ section: 'collections', view: 'invoices' }}
          />
        </FinanceKpiGrid>
      </FinanceSection>

      <FinanceSection ariaLabel="الانتباه المالي">
        <div className="mb-2 flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-black">ما الذي يحتاج إجراء الآن؟</h2>
        </div>
        <OperationalAttention
          overdueAmount={arrearsSummary.data?.totalOverdue ?? 0}
          over90Amount={arrearsSummary.data?.over90Amount ?? 0}
          pendingSettlementCount={pendingSettlementCount}
          approvedSettlementCount={approvedSettlementCount}
          canViewArrears={canViewArrears}
          canViewSettlements={canViewSettlements}
        />
      </FinanceSection>
    </div>
  );
}

export default FinanceOperationsOverview;
