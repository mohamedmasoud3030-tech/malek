import { Link } from '@tanstack/react-router';
import { CalendarRange, FileChartColumn, HandCoins, Landmark, RefreshCw, WalletCards } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { formatCompanyMoney, formatCompanyNumber } from '@/lib/companyFormatters';
import { useOwnerFinancialAuthority } from '../useOwnerFinancialAuthority';

function currentMonthPeriod() {
  const to = getTodayLocalDateString();
  return { from: `${to.slice(0, 7)}-01`, to };
}

function FinancialValue({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums" dir="ltr">{value}</p>
      {hint ? <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function OwnerFinancialAuthoritySection({
  ownerId,
  ownerName,
  canOpenOwnerSettlements = false,
}: Readonly<{
  ownerId: string;
  ownerName: string;
  canOpenOwnerSettlements?: boolean;
}>) {
  const initial = useMemo(currentMonthPeriod, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const companySettings = useCompanySettingsContract();
  const periodValid = Boolean(from && to && from <= to);
  const query = useOwnerFinancialAuthority(ownerId, from, to);
  const authority = query.data;
  const position = authority?.position;
  const statement = authority?.statement;

  return (
    <Card data-owner-financial-authority>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-primary" aria-hidden="true" />
              الموقف المالي للمالك
            </CardTitle>
            <CardDescription className="mt-1">
              أرقام الخادم المعتمدة للفترة والتسويات — مستقلة عن ذمم المستأجرين المعروضة أدناه.
            </CardDescription>
          </div>
          {position?.basis ? <StatusBadge tone="info">{position.basis}</StatusBadge> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label className="space-y-1.5 text-xs font-bold text-muted-foreground">
            من
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="بداية فترة الموقف المالي" />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-muted-foreground">
            إلى
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="نهاية فترة الموقف المالي" />
          </label>
          <Button type="button" variant="secondary" className="min-h-11" onClick={() => void query.refetch()} disabled={!periodValid || query.isFetching}>
            <RefreshCw className={`me-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
            تحديث
          </Button>
        </div>
        {!periodValid ? <p className="text-xs font-bold text-danger">تاريخ بداية الفترة يجب ألا يكون بعد تاريخ النهاية.</p> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {query.isLoading ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm font-semibold text-muted-foreground">جارٍ تحميل الموقف المالي المعتمد...</div>
        ) : null}

        {query.isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
            <p className="font-bold text-danger">تعذر تحميل الموقف المالي للمالك.</p>
            <p className="mt-1 text-xs text-muted-foreground">{query.error instanceof Error ? query.error.message : 'أعد المحاولة بعد التحقق من الفترة والصلاحيات.'}</p>
            <Button type="button" variant="secondary" className="mt-3 min-h-11" onClick={() => void query.refetch()}>إعادة المحاولة</Button>
          </div>
        ) : null}

        {position ? (
          <>
            <section aria-labelledby="owner-period-position-title" className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="size-4 text-primary" aria-hidden="true" />
                <h3 id="owner-period-position-title" className="font-black">اقتصاديات الفترة</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <FinancialValue label="تحصيلات المستأجرين" value={formatCompanyMoney(companySettings, position.period.tenant_collections)} />
                <FinancialValue label="رسوم الإدارة" value={formatCompanyMoney(companySettings, position.period.management_fees.amount)} />
                <FinancialValue label="ضريبة رسوم الإدارة" value={formatCompanyMoney(companySettings, position.period.fee_vat)} hint="تبقى ضريبة رسوم، ولا تدمج داخل المصروفات." />
                <FinancialValue label="مصروفات على المالك" value={formatCompanyMoney(companySettings, position.period.owner_expenses)} />
                <FinancialValue label="تعديلات معتمدة" value={formatCompanyMoney(companySettings, position.period.authorized_adjustments)} />
                <FinancialValue label="صافي مستحق المالك للفترة" value={formatCompanyMoney(companySettings, position.period.net_payable)} hint="قيمة معتمدة من خادم التسويات." />
              </div>
            </section>

            <section aria-labelledby="owner-lifecycle-position-title" className="space-y-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <WalletCards className="size-4 text-primary" aria-hidden="true" />
                  <h3 id="owner-lifecycle-position-title" className="font-black">موقف التسويات عبر كل الفترات</h3>
                </div>
                {position.operating_model ? <StatusBadge tone="neutral">{position.operating_model}</StatusBadge> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FinancialValue label="متبقي مستحق للمالك" value={formatCompanyMoney(companySettings, position.lifecycle_all_time.remaining_payable)} />
                <FinancialValue label="صافي مدفوع سابقاً" value={formatCompanyMoney(companySettings, position.lifecycle_all_time.paid_net)} />
                <FinancialValue label="صافي تسويات معلقة" value={formatCompanyMoney(companySettings, position.lifecycle_all_time.settled_pending_net)} />
                <FinancialValue label="أموال المالك المحتجزة" value={formatCompanyMoney(companySettings, position.owner_funds.held)} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <StatusBadge tone="neutral">{formatCompanyNumber(companySettings, position.lifecycle_all_time.draft_count)} مسودة</StatusBadge>
                <StatusBadge tone="info">{formatCompanyNumber(companySettings, position.lifecycle_all_time.approved_count)} معتمدة</StatusBadge>
                <StatusBadge tone="success">{formatCompanyNumber(companySettings, position.lifecycle_all_time.paid_count)} مدفوعة</StatusBadge>
                <StatusBadge tone="danger">{formatCompanyNumber(companySettings, position.lifecycle_all_time.cancelled_count)} ملغاة</StatusBadge>
              </div>
            </section>

            {statement ? (
              <section aria-labelledby="owner-statement-summary-title" className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileChartColumn className="size-4 text-primary" aria-hidden="true" />
                  <h3 id="owner-statement-summary-title" className="font-black">ملخص كشف حساب الفترة</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <FinancialValue label="إجمالي الكشف" value={formatCompanyMoney(companySettings, statement.total_gross)} />
                  <FinancialValue label="إجمالي الاستقطاعات" value={formatCompanyMoney(companySettings, statement.total_deductions)} />
                  {statement.total_net !== null ? <FinancialValue label="صافي الكشف" value={formatCompanyMoney(companySettings, statement.total_net)} /> : null}
                </div>
                <p className="text-xs font-medium text-muted-foreground">ملخص الكشف صادر من `rpt_owner_statement` لنفس الفترة؛ لا يعاد اشتقاق صافي الكشف في الواجهة.</p>
              </section>
            ) : null}

            {canOpenOwnerSettlements ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-black">متابعة تسويات {ownerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">تفتح مساحة التسويات مقيدة بهذا المالك؛ لن تحتاج لإعادة اختياره.</p>
                </div>
                <Button asChild className="min-h-11">
                  <Link
                    to="/financials"
                    search={{ section: 'funds', view: 'owner_settlements', ownerId }}
                  >
                    <HandCoins className="me-2 size-4" aria-hidden="true" />
                    فتح تسويات هذا المالك
                  </Link>
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
