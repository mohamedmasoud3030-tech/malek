import { Link } from '@tanstack/react-router';
import { CalendarRange, FileChartColumn, HandCoins, Landmark, RefreshCw, Vault, Wallet, WalletCards, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
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
      {hint ? <p className="mt-1 text-xs font-medium text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DisclosureSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: Readonly<{
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}>) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-border/70 bg-card open:shadow-sm" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div className="space-y-3 border-t border-border/70 p-4">{children}</div>
    </details>
  );
}

/**
 * Owner financial authority — the server-authoritative financial position of
 * one owner, rendered inside the canonical owner dossier.
 *
 * Progressive disclosure: a concise KPI summary is always visible; the period
 * economics, the settlement lifecycle, and the statement summary expand on
 * demand. All figures come from the settlement server authority
 * (`rpt_owner_financial_position` / `rpt_owner_statement`); nothing is
 * recomputed in the browser.
 */
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
    <section data-owner-financial-authority aria-labelledby="owner-financial-authority-heading" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h2 id="owner-financial-authority-heading" className="flex items-center gap-2 text-base font-black">
            <Landmark className="size-5 text-primary" aria-hidden="true" />
            الموقف المالي للمالك
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أرقام الخادم المعتمدة للفترة والتسويات — لا يعاد اشتقاق أي قيمة في الواجهة.
          </p>
        </div>
        {position?.basis ? <StatusBadge tone="info">{position.basis}</StatusBadge> : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <EntityForm.Field label="من">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="بداية فترة الموقف المالي" />
        </EntityForm.Field>
        <EntityForm.Field label="إلى">
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="نهاية فترة الموقف المالي" />
        </EntityForm.Field>
        <Button type="button" variant="secondary" className="min-h-11" onClick={() => void query.refetch()} disabled={!periodValid || query.isFetching}>
          <RefreshCw className={`me-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          تحديث
        </Button>
      </div>
      {!periodValid ? <p className="text-xs font-bold text-danger">تاريخ بداية الفترة يجب ألا يكون بعد تاريخ النهاية.</p> : null}

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
          {/* Concise summary first: the three numbers an operator actually acts on. */}
          <ResponsiveCardGrid>
            <KpiCard
              label="صافي مستحق المالك للفترة"
              value={formatCompanyMoney(companySettings, position.period.net_payable)}
              sub="قيمة معتمدة من خادم التسويات"
              icon={Wallet}
              accent="primary"
            />
            <KpiCard
              label="متبقي مستحق عبر كل الفترات"
              value={formatCompanyMoney(companySettings, position.lifecycle_all_time.remaining_payable)}
              sub={position.operating_model ?? undefined}
              icon={WalletCards}
              accent="emerald"
            />
            <KpiCard
              label="أموال المالك المحتجزة"
              value={formatCompanyMoney(companySettings, position.owner_funds.held)}
              icon={Vault}
              accent="amber"
            />
          </ResponsiveCardGrid>

          <DisclosureSection title="اقتصاديات الفترة بالتفصيل" icon={CalendarRange}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FinancialValue label="تحصيلات المستأجرين" value={formatCompanyMoney(companySettings, position.period.tenant_collections)} />
              <FinancialValue label="رسوم الإدارة" value={formatCompanyMoney(companySettings, position.period.management_fees.amount)} />
              <FinancialValue label="ضريبة رسوم الإدارة" value={formatCompanyMoney(companySettings, position.period.fee_vat)} hint="تبقى ضريبة رسوم، ولا تدمج داخل المصروفات." />
              <FinancialValue label="مصروفات على المالك" value={formatCompanyMoney(companySettings, position.period.owner_expenses)} />
              <FinancialValue label="تعديلات معتمدة" value={formatCompanyMoney(companySettings, position.period.authorized_adjustments)} />
              <FinancialValue label="صافي مستحق المالك للفترة" value={formatCompanyMoney(companySettings, position.period.net_payable)} />
            </div>
            {position.period.adjustments_note ? (
              <p className="text-xs font-medium text-muted-foreground">{position.period.adjustments_note}</p>
            ) : null}
          </DisclosureSection>

          <DisclosureSection title="دورة التسويات عبر كل الفترات" icon={WalletCards}>
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
          </DisclosureSection>

          {statement ? (
            <DisclosureSection title="ملخص كشف حساب الفترة" icon={FileChartColumn}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <FinancialValue label="إجمالي الكشف" value={formatCompanyMoney(companySettings, statement.total_gross)} />
                <FinancialValue label="إجمالي الاستقطاعات" value={formatCompanyMoney(companySettings, statement.total_deductions)} />
                {statement.total_net !== null ? <FinancialValue label="صافي الكشف" value={formatCompanyMoney(companySettings, statement.total_net)} /> : null}
              </div>
              <p className="text-xs font-medium text-muted-foreground">ملخص الكشف صادر من `rpt_owner_statement` لنفس الفترة؛ لا يعاد اشتقاق صافي الكشف في الواجهة.</p>
            </DisclosureSection>
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
    </section>
  );
}
