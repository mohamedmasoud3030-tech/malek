import type {
  ArrearsSummaryReport,
  CollectionSummaryReport,
} from '@/features/financials/reports/financialReportsService';

export type FinanceCockpitState = Readonly<{
  collectionRate: number;
  attentionLabel: string;
  attentionDetail: string;
  attentionTone: 'danger' | 'warning' | 'success';
  nextActionLabel: string;
  nextAction: 'arrears' | 'collections';
}>;

export function getFinanceCockpitState(
  summary: CollectionSummaryReport | undefined,
  arrears: ArrearsSummaryReport | undefined,
): FinanceCockpitState {
  const invoiced = Math.max(summary?.invoiced ?? 0, 0);
  const paid = Math.max(summary?.paid ?? 0, 0);
  const outstanding = Math.max(summary?.outstanding ?? 0, 0);
  const overdue = Math.max(arrears?.totalOverdue ?? 0, 0);
  const collectionRate = invoiced > 0 ? Math.min(Math.round((paid / invoiced) * 100), 100) : 0;

  if (overdue > 0) {
    return {
      collectionRate,
      attentionLabel: 'متأخرات تحتاج تدخلاً',
      attentionDetail: `${arrears?.overdueInvoiceCount ?? 0} فاتورة تجاوزت موعدها`,
      attentionTone: 'danger',
      nextActionLabel: 'راجع المتأخرات أولاً',
      nextAction: 'arrears',
    };
  }

  if (outstanding > 0) {
    return {
      collectionRate,
      attentionLabel: 'تحصيل غير مكتمل',
      attentionDetail: `${summary?.invoicesCount ?? 0} فاتورة ضمن حركة الشهر`,
      attentionTone: 'warning',
      nextActionLabel: 'استكمل التحصيل',
      nextAction: 'collections',
    };
  }

  return {
    collectionRate,
    attentionLabel: 'لا توجد مبالغ معلّقة',
    attentionDetail: invoiced > 0 ? 'تحصيل الشهر مكتمل' : 'لا توجد فواتير في نطاق الشهر',
    attentionTone: 'success',
    nextActionLabel: 'راجع حركة التحصيل',
    nextAction: 'collections',
  };
}
