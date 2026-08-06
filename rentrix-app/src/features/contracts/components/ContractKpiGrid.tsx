import { CalendarClock, FileText, WalletCards } from 'lucide-react';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { isContractStatus } from '@/lib/contractStatus';
import { formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { isExpiringSoon } from '../hooks/useContractFilters';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export function summarizeContracts(contracts: ContractListItem[]) {
  return contracts.reduce(
    (summary, contract) => ({
      total: summary.total + 1,
      active: summary.active + (isContractStatus(contract.status, 'active') ? 1 : 0),
      expiringSoon: summary.expiringSoon + (isExpiringSoon(contract) ? 1 : 0),
      rentTotal: summary.rentTotal + (Number.isFinite(contract.rent_amount) ? contract.rent_amount : 0),
    }),
    { total: 0, active: 0, expiringSoon: 0, rentTotal: 0 },
  );
}

function ContractMetric({
  label,
  value,
  hint,
  icon: Icon,
}: Readonly<{
  label: string;
  value: string;
  hint: string;
  icon: typeof FileText;
}>) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card p-4 shadow-card">
      <div
        className="absolute inset-inline-end-0 inset-block-start-0 size-24 rounded-full bg-primary/7 blur-2xl transition-colors group-hover:bg-primary/12"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-black tabular-nums">{value}</p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/8 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

export function ContractKpiGrid({
  companySettings,
  contracts,
  filteredContracts,
  totalCount,
}: {
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  filteredContracts: ContractListItem[];
  totalCount: number;
}) {
  const listSummary = summarizeContracts(contracts);
  const visibleSummary = summarizeContracts(filteredContracts);
  const activeRate = listSummary.total > 0
    ? Math.round((listSummary.active / listSummary.total) * 100)
    : 0;

  return (
    <section
      data-contract-summary
      aria-label="ملخص دورة العقود"
      className="grid gap-3 lg:grid-cols-[minmax(17rem,1.05fr)_minmax(0,2fr)]"
    >
      <article className="relative overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-5 text-sidebar-foreground shadow-elevated">
        <div
          className="absolute -inset-inline-end-12 -inset-block-start-16 size-48 rounded-full bg-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-sidebar-foreground/65">العقود النشطة في الصفحة</p>
              <p className="mt-2 text-4xl font-black tabular-nums">{formatCount(activeRate)}%</p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
              <WalletCards className="size-6" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-sidebar-accent">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${Math.min(100, Math.max(0, activeRate))}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-sidebar-foreground/72">
            <span>{formatCount(listSummary.active)} نشطة</span>
            <span>{formatCount(listSummary.expiringSoon)} تنتهي قريبًا</span>
          </div>
        </div>
      </article>

      <div className="grid gap-3 sm:grid-cols-3">
        <ContractMetric
          label="إجمالي العقود"
          value={formatCount(totalCount)}
          hint="حسب فلتر الحالة الحالي"
          icon={FileText}
        />
        <ContractMetric
          label="تنتهي قريبًا"
          value={formatCount(listSummary.expiringSoon)}
          hint="خلال 30 يومًا"
          icon={CalendarClock}
        />
        <ContractMetric
          label="إيجار العقود الظاهرة"
          value={formatContractMoney(companySettings, visibleSummary.rentTotal)}
          hint="بعد البحث والفلاتر"
          icon={WalletCards}
        />
      </div>
    </section>
  );
}
