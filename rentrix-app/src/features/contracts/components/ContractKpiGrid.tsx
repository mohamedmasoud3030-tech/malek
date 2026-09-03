import { AlertTriangle, Clock3, FileText, WalletCards } from 'lucide-react';
import { RegisterAttention, RegisterMetricStrip } from '@/components/layout/register-summary';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { isContractStatus } from '@/lib/contractStatus';
import { formatContractMoney } from '../contractDisplayFormatters';
import type { ContractListItem } from '../services/contractService';
import { isExpiringSoon } from '../hooks/useContractFilters';
import type { ContractAttentionState } from '../useContractAttention';
import { formatCount } from '@/lib/formatters';


/**
 * Summarizes a contract list into KPI counters.
 *
 * @scope This function is intentionally called with two different inputs by
 * ContractKpiGrid to produce metrics with different scopes:
 *
 *   - `contracts` (the unfiltered page): for expiry warnings, so they remain
 *     visible when the user applies a search filter. An expiring contract
 *     should not silently disappear from the warning strip just because it
 *     does not match the search term.
 *
 *   - `filteredContracts` (what the operator currently sees): for the rent
 *     total, so the financial metric accurately reflects the visible selection.
 *
 * Do not collapse these two calls into one; the asymmetry is intentional and
 * meaningful. The difference between the two source sets is what makes both
 * metrics correct simultaneously.
 */
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
  /**
   * Unfiltered contracts for the current server page.
   * @scope Used for expiry warnings so they stay visible when a search filter is
   * active. See summarizeContracts() @scope note.
   */
  contracts: ContractListItem[];
  /**
   * Contracts after all client-side filters (search, leaseMode, expiringOnly).
   * @scope Used for the rent total so the metric reflects the visible selection.
   * See summarizeContracts() @scope note.
   */
  filteredContracts: ContractListItem[];
  /** Server-side total count, independent of any client filter. */
  totalCount: number;
}) {
  // @scope unfiltered page — expiry warnings persist through search filters.
  const listSummary = summarizeContracts(contracts);
  // @scope filtered view — rent total reflects what the operator currently sees.
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
          {
            id: 'total',
            label: 'العقود',
            // @scope server total — all non-deleted contracts regardless of filters.
            value: formatCount(totalCount),
            icon: FileText,
          },
          {
            id: 'payment',
            label: paymentLabel,
            // @scope attention engine — batched invoice read over visible contracts.
            value: formatContractMoney(companySettings, paymentExposure),
            hint: paymentHint,
            icon: overdueExposure > 0 ? AlertTriangle : WalletCards,
            tone: overdueExposure > 0 ? 'danger' : 'warning',
            hideWhenEmpty: true,
          },
          {
            id: 'expiring',
            label: 'تنتهي قريبًا',
            // @scope unfiltered page (listSummary) — intentionally does NOT use
            // filteredContracts so that expiry warnings remain visible when a
            // search filter is active. This asymmetry is correct behavior.
            value: formatCount(listSummary.expiringSoon),
            icon: Clock3,
            tone: 'warning',
            hideWhenEmpty: true,
          },
          {
            id: 'rent',
            label: 'إيجار الظاهرة',
            // @scope filtered view (visibleSummary) — reflects the current selection.
            value: formatContractMoney(companySettings, visibleSummary.rentTotal),
            icon: WalletCards,
          },
        ]}
      />
    </section>
  );
}
