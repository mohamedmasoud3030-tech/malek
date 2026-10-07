import type { BillingStatus } from './billing-readiness-service';

export function billingStatusLabel(status: BillingStatus): string {
  switch (status) {
    case 'NOT_DUE':
      return 'غير مستحق بعد';
    case 'DUE':
      return 'جاهز للفوترة';
    case 'GENERATED':
      return 'تم إصدار الفاتورة';
    case 'BLOCKED':
      return 'يحتاج إجراءً';
    case 'CHECK_FAILED':
      return 'تعذر التحقق';
    default:
      return 'غير محدد';
  }
}

export function paymentCycleLabel(cycle: string): string {
  switch (cycle) {
    case 'monthly':
      return 'شهري';
    case 'quarterly':
      return 'ربع سنوي';
    case 'semi_annual':
      return 'نصف سنوي';
    case 'annual':
      return 'سنوي';
    default:
      return 'دوري';
  }
}

export function billingIssueMessage(reason: string | null, status: BillingStatus): string | null {
  if (!reason && status !== 'CHECK_FAILED') return null;

  const value = reason?.toUpperCase() ?? '';
  if (value.includes('AGREEMENT_MISSING')) {
    return 'أضف اتفاقية إدارة للعقد قبل إصدار الفاتورة.';
  }
  if (value.includes('MODEL_SNAPSHOT_MISSING')) {
    return 'أكمل إعداد نموذج تشغيل العقد قبل إصدار الفاتورة.';
  }
  if (value.includes('TAX_PROFILE_MISSING')) {
    return 'لا يوجد ملف ضريبي ساري يغطي تاريخ الفاتورة.';
  }
  if (value.includes('TAX_CHECK_FAILED') || status === 'CHECK_FAILED') {
    return 'تعذر التحقق من الإعداد الضريبي. أعد المحاولة، وإذا استمرت المشكلة راجع إعدادات الشركة.';
  }

  return 'يحتاج العقد إلى مراجعة قبل إصدار الفاتورة.';
}
