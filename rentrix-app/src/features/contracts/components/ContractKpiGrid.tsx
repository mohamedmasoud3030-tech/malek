import { Clock3, FileText, WalletCards } from 'lucide-react';
import { OperationalMetricCard } from '@/components/ui/operational-summary';
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
      className="grid grid-cols-2 gap-2.5 sm:gap-3"
    >
      <OperationalMetricCard
        label="نسبة العقود النشطة"
        value={`${formatCount(activeRate)}%`}
        hint={`${formatCount(listSummary.active)} نشطة في الصفحة`}
        icon={WalletCards}
      />
      <OperationalMetricCard
        label="إجمالي العقود"
        value={formatCount(totalCount)}
        hint="حسب فلتر الحالة الحالي"
        icon={FileText}
      />
      <OperationalMetricCard
        label="تنتهي قريبًا"
        value={formatCount(listSummary.expiringSoon)}
        hint="خلال نافذة المتابعة الحالية"
        icon={Clock3}
      />
      <OperationalMetricCard
        label="إيجار العقود الظاهرة"
        value={formatContractMoney(companySettings, visibleSummary.rentTotal)}
        hint="بعد البحث والفلاتر"
        icon={WalletCards}
      />
    </section>
  );
}
