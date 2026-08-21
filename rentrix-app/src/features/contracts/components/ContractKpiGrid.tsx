import { EntitySummaryStrip } from '@/components/ui/entity-summary-strip';
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

/** Keeps contract context visible without a four-card dashboard above the list. */
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
    <div data-contract-summary>
      <EntitySummaryStrip
        ariaLabel="ملخص سجل العقود"
        items={[
          { label: 'العقود', value: formatCount(totalCount) },
          { label: 'نشطة في الصفحة', value: `${formatCount(listSummary.active)} · ${formatCount(activeRate)}%`, tone: 'success' },
          { label: 'تنتهي قريبًا', value: formatCount(listSummary.expiringSoon), tone: 'warning', hidden: listSummary.expiringSoon === 0 },
          { label: 'إيجار النتائج', value: formatContractMoney(companySettings, visibleSummary.rentTotal) },
        ]}
      />
    </div>
  );
}
