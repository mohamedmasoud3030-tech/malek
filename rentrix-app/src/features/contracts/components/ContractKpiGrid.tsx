import { AlertTriangle, Clock3, FileText, WalletCards } from 'lucide-react';
import { RegisterAttention, RegisterMetricStrip } from '@/components/layout/register-summary';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { isContractStatus } from '@/lib/contractStatus';
import { formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { isExpiringSoon } from '../hooks/useContractFilters';
import type { ContractAttentionState } from '../useContractAttention';
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

/**
 * Decision-support wording for the attention banner: it names *what kind* of
 * problem dominates instead of repeating the count, so an operator can act
 * without opening a single row.
 */
function buildAttentionDescription(
  attention: ContractAttentionState | undefined,
  companySettings: CompanySettingsContract,
): string | undefined {
  if (!attention) return undefined;
  const { summary } = attention;
  const parts: string[] = [];

  if (summary.paymentAttention > 0) {
    const exposure = summary.overdueAmount > 0 ? summary.overdueAmount : summary.outstandingAmount;
    parts.push(
      `${formatCount(summary.paymentAttention)} بمستحقات غير مسددة بإجمالي ${formatContractMoney(companySettings, exposure)}`,
    );
  }
  if (summary.expiryAttention > 0) {
    parts.push(`${formatCount(summary.expiryAttention)} منتهية أو قريبة من الانتهاء`);
  }
  if (summary.lifecycleAttention > 0) {
    parts.push(`${formatCount(summary.lifecycleAttention)} بانتظار خطوة اعتماد`);
  }
  if (attention.hasInvoiceContextError) {
    parts.push('تعذر التحقق من المدفوعات — أرقام المستحقات غير مكتملة');
  } else if (attention.isLoadingInvoiceContext) {
    parts.push('جارٍ التحقق من المدفوعات…');
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function ContractKpiGrid({
  attention,
  companySettings,
  contracts,
  filteredContracts,
  totalCount,
}: {
  /** Operational attention state (see `useContractAttention`). Optional for static fixtures. */
  attention?: ContractAttentionState;
  companySettings: CompanySettingsContract;
  contracts: ContractListItem[];
  filteredContracts: ContractListItem[];
  totalCount: number;
}) {
  const listSummary = summarizeContracts(contracts);
  const visibleSummary = summarizeContracts(filteredContracts);
  const attentionSummary = attention?.summary;

  // Payment exposure is the one figure the register could not show before:
  // overdue principal wins over merely-unpaid, because that is the money that
  // is actually at risk today.
  const overdueExposure = attentionSummary?.overdueAmount ?? 0;
  const unpaidExposure = attentionSummary?.outstandingAmount ?? 0;
  const paymentExposure = overdueExposure > 0 ? overdueExposure : unpaidExposure;
  const paymentLabel = overdueExposure > 0 ? 'متأخرات مستحقة' : 'غير مسدد';
  const paymentHint = attentionSummary
    ? overdueExposure > 0
      ? `${formatCount(attentionSummary.overdueInvoices)} فاتورة متأخرة`
      : `${formatCount(attentionSummary.paymentAttention)} عقد بمستحقات`
    : undefined;

  return (
    <section data-contract-summary aria-label="ملخص دورة العقود" className="min-w-0 space-y-2">
      <RegisterAttention
        count={attentionSummary?.needingAttention ?? 0}
        label="عقود تحتاج متابعة"
        description={buildAttentionDescription(attention, companySettings)}
      />
      <RegisterMetricStrip
        aria-label="ملخص دورة العقود"
        items={[
          { id: 'total', label: 'العقود', value: formatCount(totalCount), icon: FileText },
          {
            id: 'payment',
            label: paymentLabel,
            value: formatContractMoney(companySettings, paymentExposure),
            hint: paymentHint,
            icon: overdueExposure > 0 ? AlertTriangle : WalletCards,
            tone: overdueExposure > 0 ? 'danger' : 'warning',
            hideWhenEmpty: true,
          },
          { id: 'expiring', label: 'تنتهي قريبًا', value: formatCount(listSummary.expiringSoon), icon: Clock3, tone: 'warning', hideWhenEmpty: true },
          { id: 'rent', label: 'إيجار الظاهرة', value: formatContractMoney(companySettings, visibleSummary.rentTotal), icon: WalletCards },
        ]}
      />
    </section>
  );
}
