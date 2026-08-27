import { useMemo } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, FileCheck, Landmark, Wallet } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { useActiveCompanyId } from '@/hooks/use-company';
import { buildCompanySettingsSearch } from '@/features/governance-hub/governance-hub-navigation';
import { getFinanceReadiness, type FinanceReadiness, type ReadinessState } from './finance-readiness-service';

function toneForState(state: ReadinessState): 'success' | 'warning' | 'danger' | 'info' {
  if (state === 'READY') return 'success';
  if (state === 'DRAFT_NEEDS_APPROVAL') return 'warning';
  if (state === 'MISSING') return 'danger';
  return 'info';
}

function labelForState(state: ReadinessState): string {
  if (state === 'READY') return 'جاهز';
  if (state === 'DRAFT_NEEDS_APPROVAL') return 'بانتظار الاعتماد';
  if (state === 'MISSING') return 'يحتاج إعدادًا';
  return 'تعذر التحقق';
}

function readinessMessage(state: ReadinessState, missingMessage: string): string {
  if (state === 'READY') return 'الإعداد مكتمل وجاهز للاستخدام.';
  if (state === 'DRAFT_NEEDS_APPROVAL') return 'يوجد إعداد محفوظ ينتظر اعتماد مستخدم مخوّل آخر.';
  if (state === 'MISSING') return missingMessage;
  return 'تعذر التحقق من هذا الإعداد الآن. أعد المحاولة، وإذا استمرت المشكلة راجع إعدادات الشركة.';
}

function TaxReadinessCard({
  title,
  state,
  rate,
  effectiveFrom,
  missingMessage,
  icon: Icon,
}: Readonly<{
  title: string;
  state: ReadinessState;
  rate: number | null;
  effectiveFrom: string | null;
  missingMessage: string;
  icon: typeof FileCheck;
}>) {
  return (
    <Card variant={state === 'READY' ? 'default' : 'muted'}>
      <CardHeader className="pb-2">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{title}</span>
          <StatusBadge tone={toneForState(state)}>{labelForState(state)}</StatusBadge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-xs leading-5">
        <p className={state === 'MISSING' ? 'text-destructive' : 'text-muted-foreground'}>
          {readinessMessage(state, missingMessage)}
        </p>
        {state === 'READY' && rate !== null ? <p><span className="font-bold">النسبة الحالية:</span> {rate}%</p> : null}
        {state === 'READY' && effectiveFrom ? <p className="text-muted-foreground">سارية من {effectiveFrom}</p> : null}
        {/* Every non-ready tax setting links straight to its corrective surface. */}
        {state !== 'READY' ? (
          <Link
            to="/settings"
            search={buildCompanySettingsSearch({}, 'finance-readiness') as never}
            className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline"
          >
            فتح إعدادات الضريبة
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TaxReadiness({ readiness }: { readiness: FinanceReadiness }) {
  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="جاهزية الضريبة">
      <TaxReadinessCard
        title="ضريبة الإيجار"
        state={readiness.rentTax.state}
        rate={readiness.rentTax.activeProfile?.tax_rate ?? null}
        effectiveFrom={readiness.rentTax.activeProfile?.effective_from ?? null}
        missingMessage="أكمل إعداد ضريبة الإيجار قبل إصدار الفواتير."
        icon={FileCheck}
      />
      <TaxReadinessCard
        title="ضريبة أتعاب الإدارة النسبية"
        state={readiness.rateFeeTax.state}
        rate={readiness.rateFeeTax.activeTreatment?.tax_rate ?? null}
        effectiveFrom={readiness.rateFeeTax.activeTreatment?.effective_from ?? null}
        missingMessage="أكمل إعداد ضريبة أتعاب الإدارة قبل تسجيل التحصيل المرتبط بها."
        icon={Wallet}
      />
      <TaxReadinessCard
        title="ضريبة الأتعاب الشهرية"
        state={readiness.fixedFeeTax.state}
        rate={readiness.fixedFeeTax.activeTreatment?.tax_rate ?? null}
        effectiveFrom={readiness.fixedFeeTax.activeTreatment?.effective_from ?? null}
        missingMessage="أكمل إعداد ضريبة الأتعاب الشهرية قبل تسجيل الاستحقاق."
        icon={CalendarDays}
      />
    </ResponsiveCardGrid>
  );
}

function GeneralReadiness({ readiness }: { readiness: FinanceReadiness }) {
  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="جاهزية المحاسبة والدفع">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileCheck className="size-4" aria-hidden="true" />
            دليل الحسابات
            <StatusBadge tone={toneForState(readiness.chartOfAccounts.state)}>{labelForState(readiness.chartOfAccounts.state)}</StatusBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-5">
          <p className="text-muted-foreground">
            {readinessMessage(readiness.chartOfAccounts.state, 'دليل الحسابات غير مكتمل. أكمله قبل العمليات المحاسبية.')}
          </p>
          {readiness.chartOfAccounts.state !== 'READY' ? (
            <Button asChild size="sm" variant="outline" className="min-h-11">
              <Link to="/reports" search={{ section: 'accounting' } as never}>فتح المحاسبة</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4" aria-hidden="true" />
            الفترة المحاسبية
            <StatusBadge tone={toneForState(readiness.accountingPeriod.state)}>{labelForState(readiness.accountingPeriod.state)}</StatusBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs leading-5">
          {readiness.accountingPeriod.openPeriod ? (
            <p>الفترة الحالية: {readiness.accountingPeriod.openPeriod.start_date} → {readiness.accountingPeriod.openPeriod.end_date}</p>
          ) : (
            <p className="text-destructive">لا توجد فترة محاسبية مفتوحة. افتح فترة قبل تسجيل القيود الجديدة.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Landmark className="size-4" aria-hidden="true" />
            النقد والبنوك
            <StatusBadge tone={toneForState(readiness.paymentMethods.state)}>{labelForState(readiness.paymentMethods.state)}</StatusBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs leading-5">
          {readiness.paymentMethods.state === 'READY' ? (
            <p className="flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" /> جاهز لتسجيل طرق الدفع</p>
          ) : (
            <p className="flex items-start gap-1 text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> راجع إعداد الحسابات النقدية والبنكية قبل تسجيل المدفوعات.</p>
          )}
        </CardContent>
      </Card>
    </ResponsiveCardGrid>
  );
}

export function FinanceReadinessSection() {
  const companyId = useActiveCompanyId();

  const readinessQuery = useQuery({
    queryKey: ['finance-readiness', companyId],
    enabled: Boolean(companyId),
    queryFn: () => getFinanceReadiness(companyId!),
  });

  const readiness = readinessQuery.data;
  const status = useMemo(() => {
    if (readinessQuery.isLoading) return 'loading' as const;
    if (readinessQuery.isError) return 'error' as const;
    if (!readiness) return 'empty' as const;
    return 'ready' as const;
  }, [readiness, readinessQuery.isError, readinessQuery.isLoading]);

  return (
    <Card data-finance-readiness>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">جاهزية المالية والضريبة</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">راجع الإعدادات التي تمنع الفوترة أو التحصيل، ثم أكمل المطلوب فقط.</p>
      </CardHeader>
      <CardContent>
        <AsyncContentState
          status={status}
          error={readinessQuery.error as Error}
          errorTitle="تعذر التحقق من جاهزية المالية"
          errorAction={<Button onClick={() => readinessQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا توجد بيانات جاهزية"
          emptyDescription="أعد المحاولة بعد اختيار الشركة."
        >
          {readiness ? (
            <div className="space-y-3">
              <TaxReadiness readiness={readiness} />
              <GeneralReadiness readiness={readiness} />
            </div>
          ) : null}
        </AsyncContentState>
      </CardContent>
    </Card>
  );
}
