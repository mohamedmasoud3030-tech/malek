import { Clock3, FileText, WalletCards } from 'lucide-react';
import { RegisterMetricStrip } from '@/components/layout/register-summary';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { isContractStatus } from '@/lib/contractStatus';
import { formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { isExpiringSoon } from '../hooks/useContractFilters';
import { formatCount } from '@/lib/formatters';


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
    <section data-contract-summary aria-label="ملخص دورة العقود">
      <RegisterMetricStrip
        aria-label="ملخص دورة العقود"
        items={[
          { id: 'total', label: 'العقود', value: formatCount(totalCount), icon: FileText },
          { id: 'active', label: 'نشطة', value: `${formatCount(activeRate)}%`, hint: `${formatCount(listSummary.active)} في الصفحة`, icon: WalletCards },
          { id: 'expiring', label: 'تنتهي قريبًا', value: formatCount(listSummary.expiringSoon), icon: Clock3, tone: 'warning', hideWhenEmpty: true },
          { id: 'rent', label: 'إيجار الظاهرة', value: formatContractMoney(companySettings, visibleSummary.rentTotal), icon: WalletCards },
        ]}
      />
    </section>
  );
}
