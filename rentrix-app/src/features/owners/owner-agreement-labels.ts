/**
 * Owner-agreement vocabulary — the Arabic labels for the commission basis the
 * database permits (`owner_agreements_commission_type_check`: RATE |
 * FIXED_MONTHLY). Pure module so dossiers, the agreements manager, the
 * statements surface and the printed owner pack all name the basis the same
 * way; the value itself (percent vs. monthly amount) is formatted by each
 * surface through its own company formatter.
 */
import type { CommissionType } from './ownerAgreementService';

export const commissionTypeLabels: Record<CommissionType, string> = {
  RATE: 'نسبة من التحصيل',
  FIXED_MONTHLY: 'مبلغ شهري ثابت',
};

/** Raw statement/RPC values are strings; unknown values fall back to the raw token rather than a fabricated label. */
export function formatCommissionTypeLabel(type: string | null | undefined): string {
  if (!type) return 'غير محددة';
  return commissionTypeLabels[type as CommissionType] ?? type;
}
