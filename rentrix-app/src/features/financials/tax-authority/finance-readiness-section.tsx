import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Wallet, Building2, CalendarDays, Landmark, FileCheck } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AsyncContentState } from '@/components/async-content-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { useActiveCompanyId } from '@/hooks/use-company';
import { getFinanceReadiness, type FinanceReadiness, type ReadinessState } from './finance-readiness-service';

function toneForState(state: ReadinessState): 'success' | 'warning' | 'danger' | 'info' {
  if (state === 'READY') return 'success';
  if (state === 'MISSING') return 'danger';
  if (state === 'DRAFT_NEEDS_APPROVAL') return 'warning';
  return 'info';
}

function labelForState(state: ReadinessState): string {
  if (state === 'READY') return 'جاهز';
  if (state === 'MISSING') return 'غير مُهيأ';
  if (state === 'DRAFT_NEEDS_APPROVAL') return 'بانتظار الاعتماد';
  return 'محظور';
}

function TaxReadinessCard({ readiness }: { readiness: FinanceReadiness }) {
  const rent = readiness.rentTax;
  const rate = readiness.rateFeeTax;
  const fixed = readiness.fixedFeeTax;

  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="جاهزية المعالجة الضريبية">
      <Card variant={rent.state === 'READY' ? 'default' : 'muted'}>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <FileCheck className="size-4 shrink-0" />
            <span className="min-w-0 break-words">ضريبة الإيجار</span>
            <StatusBadge tone={toneForState(rent.state)}>{labelForState(rent.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">
            السلطة المعتمدة حسب التاريخ لاحتساب ضريبة الفواتير المتكررة. لا يُستخدم company_settings.vat_rate كسلطة للفوترة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {rent.activeProfile ? (
            <>
              <p><span className="font-bold">الكود:</span> {rent.activeProfile.tax_code} — {rent.activeProfile.tax_rate}%</p>
              <p>
                <span className="font-bold">سارٍ من:</span> {rent.activeProfile.effective_from}
                {rent.activeProfile.effective_to ? ` إلى ${rent.activeProfile.effective_to}` : ' (مفتوح)'}
              </p>
              <p><span className="font-bold">الإصدار:</span> {rent.activeProfile.version_no} — {rent.activeProfile.status}</p>
            </>
          ) : rent.latestDraft ? (
            <>
              <p className="flex items-center gap-1 text-warning">
                <Clock className="size-3.5 shrink-0" />
                مسودة بانتظار اعتماد مدقق مختلف: {rent.latestDraft.tax_code} {rent.latestDraft.tax_rate}% من {rent.latestDraft.effective_from}
              </p>
              <p className="text-muted-foreground">يجب أن يعتمد مستخدم مختلف لتصبح نافذة. فشل الفوترة المغلق TAX_PROFILE_MISSING سيستمر حتى التفعيل.</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>عرض مسودات الضريبة</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                لا يوجد ملف ضريبي نافذ يغطي اليوم. الفوترة ستفشل مغلقًا TAX_PROFILE_MISSING.
              </p>
              <Button asChild size="sm" variant="default">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>إنشاء ملف ضريبي</Link>
              </Button>
            </>
          )}
          {rent.errorCode && rent.state === 'BLOCKED' ? <p className="text-destructive">خطأ: {rent.errorCode}</p> : null}
        </CardContent>
      </Card>

      <Card variant={rate.state === 'READY' ? 'default' : 'muted'}>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Wallet className="size-4 shrink-0" />
            <span className="min-w-0 break-words">ضريبة أتعاب الإدارة (نسبي)</span>
            <StatusBadge tone={toneForState(rate.state)}>{labelForState(rate.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">معالجة ضريبة مستقلة لأتعاب الإدارة عند التحصيل (RATE). تفشل مغلقًا FEE_TAX_TREATMENT_MISSING عند النقص.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {rate.activeTreatment ? (
            <>
              <p><span className="font-bold">الكود:</span> {rate.activeTreatment.tax_code} — {rate.activeTreatment.tax_rate}%</p>
              <p><span className="font-bold">سارٍ من:</span> {rate.activeTreatment.effective_from}</p>
              <p><span className="font-bold">الإصدار:</span> {rate.activeTreatment.version_no}</p>
            </>
          ) : rate.latestDraft ? (
            <>
              <p className="flex items-center gap-1 text-warning">
                <Clock className="size-3.5 shrink-0" />
                مسودة بانتظار الاعتماد: {rate.latestDraft.tax_code} {rate.latestDraft.tax_rate}% من {rate.latestDraft.effective_from}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>عرض مسودات معالجة الأتعاب</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                لا توجد معالجة ضريبة أتعاب نسبية نافذة. تحصيل الأتعاب النسبية سيفشل مغلقًا.
              </p>
              <Button asChild size="sm" variant="default">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>إنشاء معالجة</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card variant={fixed.state === 'READY' ? 'default' : 'muted'}>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <CalendarDays className="size-4 shrink-0" />
            <span className="min-w-0 break-words">ضريبة أتعاب الإدارة (شهري ثابت)</span>
            <StatusBadge tone={toneForState(fixed.state)}>{labelForState(fixed.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">معالجة ضريبة مستقلة للاستحقاق الشهري الثابت (FIXED_MONTHLY). فشل مغلق عند النقص.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {fixed.activeTreatment ? (
            <>
              <p><span className="font-bold">الكود:</span> {fixed.activeTreatment.tax_code} — {fixed.activeTreatment.tax_rate}%</p>
              <p><span className="font-bold">سارٍ من:</span> {fixed.activeTreatment.effective_from}</p>
              <p><span className="font-bold">الإصدار:</span> {fixed.activeTreatment.version_no}</p>
            </>
          ) : fixed.latestDraft ? (
            <>
              <p className="flex items-center gap-1 text-warning">
                <Clock className="size-3.5 shrink-0" />
                مسودة بانتظار الاعتماد: {fixed.latestDraft.tax_code} {fixed.latestDraft.tax_rate}% من {fixed.latestDraft.effective_from}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>عرض المسودات</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                لا توجد معالجة ضريبة أتعاب شهرية نافذة. الاستحقاق الشهري سيفشل مغلقًا.
              </p>
              <Button asChild size="sm" variant="default">
                <Link to="/settings" search={{ section: 'finance-readiness' } as never}>إنشاء معالجة</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </ResponsiveCardGrid>
  );
}

function GeneralReadiness({ readiness }: { readiness: FinanceReadiness }) {
  return (
    <ResponsiveCardGrid desktopColumns={3} gap="md" aria-label="جاهزية المحاسبة والدفع">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Building2 className="size-4 shrink-0" />
            <span className="min-w-0 break-words">دليل الحسابات</span>
            <StatusBadge tone={toneForState(readiness.chartOfAccounts.state)}>{labelForState(readiness.chartOfAccounts.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">يجب أن يحتوي على 18 حسابًا مطلوبًا (1111 نقدية، 1120 بنك، 1201، 1300، 2000، 2200، 2300، إلخ).</CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          <p>العدد: {readiness.chartOfAccounts.count}</p>
          {readiness.chartOfAccounts.state !== 'READY' ? (
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/reports" search={{ section: 'accounting' } as never}>فتح المحاسبة والرقابة</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <CalendarDays className="size-4 shrink-0" />
            <span className="min-w-0 break-words">الفترة المحاسبية</span>
            <StatusBadge tone={toneForState(readiness.accountingPeriod.state)}>{labelForState(readiness.accountingPeriod.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">يجب وجود فترة مفتوحة OPEN. الإغلاق الصلب HARD_CLOSED غير قابل للعكس.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          {readiness.accountingPeriod.openPeriod ? (
            <p>مفتوحة: {readiness.accountingPeriod.openPeriod.start_date} → {readiness.accountingPeriod.openPeriod.end_date}</p>
          ) : (
            <p className="text-destructive">لا توجد فترة مفتوحة. الترحيل سيتوقف.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Landmark className="size-4 shrink-0" />
            <span className="min-w-0 break-words">طرق الدفع والبنوك</span>
            <StatusBadge tone={toneForState(readiness.paymentMethods.state)}>{labelForState(readiness.paymentMethods.state)}</StatusBadge>
          </CardTitle>
          <CardDescription className="text-xs">نقدية 1111 وبنك 1120 يجب أن تكون موجودة في دليل الحسابات.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs">
          {readiness.paymentMethods.state !== 'READY' ? (
            <p className="text-destructive">تحقق من إعداد الحسابات النقدية/البنكية.</p>
          ) : (
            <p className="flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" /> جاهز</p>
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
  const isLoading = readinessQuery.isLoading;
  const isError = readinessQuery.isError;
  const isEmpty = !readiness;

  const status = useMemo(() => {
    if (isLoading) return 'loading' as const;
    if (isError) return 'error' as const;
    if (isEmpty) return 'empty' as const;
    return 'ready' as const;
  }, [isLoading, isError, isEmpty]);

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-warning" />
          جاهزية المالية والضريبة
        </CardTitle>
        <CardDescription>
          السلطة الضريبية الفعلية تُحسم من ملفات معتمدة حسب التاريخ، وليس من company_settings.vat_rate. هذه الشاشة تظهر READY / غير مُهيأ / بانتظار الاعتماد / محظور وتربط المستخدم بالإجراء التصحيحي الدقيق.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncContentState
          status={status}
          error={readinessQuery.error as Error}
          errorTitle="تعذر تحميل جاهزية المالية"
          errorAction={<Button onClick={() => readinessQuery.refetch()}>إعادة المحاولة</Button>}
          emptyTitle="لا توجد بيانات جاهزية"
          emptyDescription="تحقق من إعداد الشركة والاتصال."
        >
          {readiness ? (
            <div className="space-y-4">
              <TaxReadinessCard readiness={readiness} />
              <GeneralReadiness readiness={readiness} />
              <p className="break-words text-xs text-muted-foreground">
                تم التحقق في: {new Date(readiness.checkedAt).toLocaleString('ar')} — الشركة: {readiness.companyId.slice(0, 8)} — جميع الكتابات عبر RPCs محكومة، لا كتابات متصفح مباشرة.
              </p>
            </div>
          ) : null}
        </AsyncContentState>
      </CardContent>
    </Card>
  );
}
