import type { CompanySettingsDraft, CompanySettingsPreviewModel } from './settingsForm';
import type { SettingsSectionId } from './settingsSections';

export type SettingsSummaryTile = Readonly<{
  label: string;
  value: string;
  helper: string;
  tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral';
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
  const firstIncompleteSection: SettingsSectionId | undefined = !officeReady
    ? 'office'
    : !identityReady
      ? 'identity'
      : !documentsReady
        ? 'documents'
        : undefined;

  return [
    {
      label: 'جاهزية الإعداد',
      value: completedSetupSteps === 3 ? 'مكتملة' : `${completedSetupSteps}/3`,
      helper: completedSetupSteps === 3 ? preview.companyName : 'أكمل الهوية والطباعة والمستندات',
      tone: completedSetupSteps === 3 ? 'success' : completedSetupSteps === 0 ? 'danger' : 'warning',
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
      value: metadataMismatch ? 'تحتاج مراجعة' : hasAuthorization ? 'صالحة' : 'غير متاحة',
      helper: metadataMismatch ? 'بيانات الدور لا تطابق العقد المتوقع' : 'الوصول يعكس الجلسة الحالية فقط',
      tone: metadataMismatch ? 'warning' : hasAuthorization ? 'success' : 'neutral',
    },
  ] as const;
}
