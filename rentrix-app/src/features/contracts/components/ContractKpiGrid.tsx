import { CalendarClock, FileText, WalletCards } from 'lucide-react';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { isContractStatus } from '@/lib/contractStatus';
import { formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { isExpiringSoon } from '../hooks/useContractFilters';

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
  /** Server-exact row count for the current status filter — the loaded window is just one page. */
  totalCount: number;
}) {
  const listSummary = summarizeContracts(contracts);
  const visibleSummary = summarizeContracts(filteredContracts);

  return (
    <ResponsiveCardGrid desktopColumns={4}>
      <KpiCard label="إجمالي العقود" value={totalCount} sub="حسب فلتر الحالة الحالي" icon={FileText} accent="primary" />
      <KpiCard label="العقود النشطة" value={listSummary.active} sub="ضمن الصفحة المحملة" icon={WalletCards} accent="emerald" />
      <KpiCard label="تنتهي قريبًا" value={listSummary.expiringSoon} sub="خلال 30 يومًا" icon={CalendarClock} accent="amber" />
      <KpiCard label="إيجار الظاهرة" value={formatContractMoney(companySettings, visibleSummary.rentTotal)} sub="بعد البحث والفلاتر" icon={WalletCards} accent="sky" />
    </ResponsiveCardGrid>
  );
}
