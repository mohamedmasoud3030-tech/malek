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