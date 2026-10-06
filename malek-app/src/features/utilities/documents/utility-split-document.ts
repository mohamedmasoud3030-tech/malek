/**
 * Utility / CAM Split Sheet document adapter and actions (#22).
 *
 * Technical type: REUSE 'generic_report'.
 * Canonical authority: `src/features/utilities/utility-obligations.ts`.
 * The adapter presents canonical split and obligation data verbatim;
 * it never recalculates allocations or shares.
 */
import { documentService } from '@/services/documents/DocumentService';
import { hasCompleteCompanyIdentity, type DocumentCompanySettings } from '@/services/documents/companyIdentity';
import { runGuardedDocumentAction } from '@/services/documents/runDocumentAction';
import type { GenericReportPayload } from '@/services/documents/documentPayloads';
import type { UtilityObligation, UtilityObligationsSummary } from '../utility-obligations';

const RESPONSIBLE_PARTY_LABELS: Record<string, string> = {
  tenant: 'المستأجر',
  landlord: 'المالك',
  company: 'إدارة الأملاك / المكتب',
};

const URGENCY_LABELS: Record<string, string> = {
  overdue: 'متأخر',
  due_soon: 'يستحق قريباً',
  scheduled: 'مجدول',
  settled: 'مسدد بالكامل',
};

export function toUtilitySplitPayload(params: {
  obligations: readonly UtilityObligation[];
  summary?: UtilityObligationsSummary | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
}): GenericReportPayload {
  const { obligations, summary, periodFrom, periodTo, propertyTitle } = params;

  const rows: string[][] = obligations.map((ob) => [
    ob.billNumber || '—',
    RESPONSIBLE_PARTY_LABELS[ob.responsibleParty] ?? ob.responsibleParty,
    String(ob.amount),
    String(ob.paidAmount),
    String(ob.remainingAmount),
    ob.dueDate,
    URGENCY_LABELS[ob.urgency] ?? ob.urgency,
  ]);

  const sections = [
    {
      title: propertyTitle ? `توزيع فواتير ومرافق عقار: ${propertyTitle}` : 'كشف توزيع ومسؤوليات الفواتير والمرافق',
      columns: ['رقم الفاتورة', 'الطرف المسؤول', 'القيمة الإجمالية', 'المدفوع', 'المتبقي المستحق', 'تاريخ الاستحقاق', 'الحالة التشغيلية'],
      rows,
      totals: summary
        ? [
            'الإجمالي العام للالتزامات',
            `المستأجر: ${summary.remainingByResponsibleParty.tenant} | المالك: ${summary.remainingByResponsibleParty.landlord} | المكتب: ${summary.remainingByResponsibleParty.company}`,
            '',
            '',
            String(summary.outstandingAmount),
            '',
            `المتأخر: ${summary.overdueCount}`,
          ]
        : undefined,
    },
  ];

  const totalSummary = summary
    ? `إجمالي المستحق القائم: ${summary.outstandingAmount} | عدد الفواتير المعلقة: ${summary.outstandingCount} | المتأخر: ${summary.overdueAmount}`
    : undefined;

  return {
    reportTitle: 'كشف توزيع فواتير الخدمات والمرافق المشتركة',
    reportType: 'Utility_CAM_Split_Sheet',
    periodFrom: periodFrom ?? null,
    periodTo: periodTo ?? null,
    sections,
    totalSummary: totalSummary ?? null,
  };
}

export function printUtilitySplit(params: {
  obligations: readonly UtilityObligation[];
  settings: DocumentCompanySettings;
  summary?: UtilityObligationsSummary | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.printDocument('generic_report', {
        settings,
        payload: toUtilitySplitPayload(rest),
      }),
    fallbackMessage: 'تعذرت طباعة كشف توزيع المرافق.',
  });
}

export function downloadUtilitySplitPdf(params: {
  obligations: readonly UtilityObligation[];
  settings: DocumentCompanySettings;
  summary?: UtilityObligationsSummary | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  propertyTitle?: string | null;
}): Promise<void> {
  const { settings, ...rest } = params;
  return runGuardedDocumentAction({
    isReady: hasCompleteCompanyIdentity(settings),
    operation: () =>
      documentService.downloadDocumentPdf('generic_report', {
        settings,
        payload: toUtilitySplitPayload(rest),
      }),
    fallbackMessage: 'تعذر تصدير كشف توزيع المرافق كملف PDF.',
  });
}
