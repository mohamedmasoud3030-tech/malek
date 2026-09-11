import type { CompanySettingsDraft, CompanySettingsPreviewModel } from './settingsForm';
import type { SettingsSectionId } from './registry/sectionRegistry';
import type { SemanticTone } from '@/components/ui/status-badge';

export type SettingsSummaryTile = Readonly<{
  label: string;
  value: string;
  helper: string;
  tone: SemanticTone;
  section?: SettingsSectionId;
}>;

export function buildSettingsSummaryTiles({
  draft,
  preview,
  isDirty,
  hasAuthorization,
  metadataMismatch,
}: Readonly<{
  draft: CompanySettingsDraft;
  preview: CompanySettingsPreviewModel;
  isDirty: boolean;
  hasAuthorization: boolean;
  metadataMismatch: boolean;
}>): readonly SettingsSummaryTile[] {
  const officeReady = Boolean(draft.company_name.trim());
  const identityReady = Boolean(draft.currency && draft.locale && draft.timezone && draft.date_format && draft.number_format);
  const documentsReady = Boolean(draft.invoice_prefix.trim() && draft.contract_prefix.trim() && draft.receipt_prefix.trim());
  const completedSetupSteps = [officeReady, identityReady, documentsReady].filter(Boolean).length;
  const firstIncompleteSection: SettingsSectionId | undefined = (() => {
    if (!officeReady) return 'office';
    if (!identityReady) return 'identity';
    if (!documentsReady) return 'documents';
    return undefined;
  })();

  return [
    {
      label: 'جاهزية الإعداد',
      value: completedSetupSteps === 3 ? 'مكتملة' : `${completedSetupSteps}/3`,
      helper: completedSetupSteps === 3 ? preview.companyName : 'أكمل الهوية والطباعة والمستندات',
      tone: resolveSetupTone(completedSetupSteps),
      ...(firstIncompleteSection ? { section: firstIncompleteSection } : {}),
    },
    {
      label: 'حالة التغييرات',
      value: isDirty ? 'غير محفوظة' : 'محفوظة',
      helper: isDirty ? 'راجع ثم احفظ أو تراجع عن المسودة' : 'لا توجد تغييرات معلقة',
      tone: isDirty ? 'warning' : 'success',
    },
    {
      label: 'الجلسة والصلاحيات',
      ...resolveSessionSummary(metadataMismatch, hasAuthorization),
    },
  ] as const;
}

function resolveSetupTone(completedSteps: number): 'success' | 'danger' | 'warning' {
  if (completedSteps === 3) return 'success';
  if (completedSteps === 0) return 'danger';
  return 'warning';
}

function resolveSessionSummary(metadataMismatch: boolean, hasAuthorization: boolean): {
  value: string;
  helper: string;
  tone: 'warning' | 'success' | 'neutral';
} {
  if (metadataMismatch) {
    return { value: 'تحتاج مراجعة', helper: 'بيانات الدور لا تطابق العقد المتوقع', tone: 'warning' };
  }
  if (hasAuthorization) {
    return { value: 'صالحة', helper: 'الوصول يعكس الجلسة الحالية فقط', tone: 'success' };
  }
  return { value: 'غير متاحة', helper: 'الوصول يعكس الجلسة الحالية فقط', tone: 'neutral' };
}
