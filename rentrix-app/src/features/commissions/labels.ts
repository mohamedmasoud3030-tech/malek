/**
 * Commission status and type labels — extracted from the component file so
 * they can be reused and tested independently.
 *
 * Kept in the feature directory because these labels are specific to the
 * commissions domain (not shared across the application).
 */

export const commissionStatusLabels: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'معتمدة للتتبع',
  paid: 'مسجلة كمدفوعة',
  cancelled: 'ملغاة',
};

/**
 * Canonical commission source types (RC1 closeout, Rule 4).
 *
 * 'payment' is NOT a commission source type: commissions attach to a deal
 * (contract, owner, lead or land). It was removed from the writable domain
 * (client validator, RPCs and the DB CHECK commissions_type_check). The
 * display label below is kept only so any legacy read-only row still renders
 * a human-readable name; the option never appears in create/edit forms.
 */
export const commissionSourceTypeOptions = ['contract', 'owner', 'lead', 'land'] as const;

export function isCommissionSourceType(type: string | null | undefined): type is (typeof commissionSourceTypeOptions)[number] {
  return typeof type === 'string' && (commissionSourceTypeOptions as readonly string[]).includes(type);
}

export const commissionTypeLabels: Record<string, string> = {
  contract: 'عقد',
  payment: 'تحصيل',
  owner: 'مالك',
  lead: 'عميل محتمل',
  land: 'أرض',
};

export const commissionStatusTone: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pending: 'warning',
  approved: 'info',
  paid: 'success',
  cancelled: 'danger',
};