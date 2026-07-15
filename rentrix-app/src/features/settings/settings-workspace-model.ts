import type { CompanySettingsDraft, CompanySettingsPreviewModel } from './settingsForm';

export type SettingsSummaryTile = Readonly<{
  label: string;
  value: string;
  helper: string;
  tone: 'green' | 'blue' | 'gold' | 'red' | 'gray';
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
  const completedSetupSteps = [
    Boolean(draft.company_name.trim()),
    Boolean(draft.currency && draft.locale && draft.timezone && draft.date_format && draft.number_format),
    Boolean(draft.invoice_prefix.trim() && draft.contract_prefix.trim() && draft.receipt_prefix.trim()),
  ].filter(Boolean).length;

  return [
    {
      label: 'جاهزية الإعداد',
      value: completedSetupSteps === 3 ? 'مكتملة' : `${completedSetupSteps}/3`,
      helper: completedSetupSteps === 3 ? preview.companyName : 'أكمل الهوية والطباعة والمستندات',
      tone: completedSetupSteps === 3 ? 'green' : completedSetupSteps === 0 ? 'red' : 'gold',
    },
    {
      label: 'حالة التغييرات',
      value: isDirty ? 'غير محفوظة' : 'محفوظة',
      helper: isDirty ? 'راجع ثم احفظ أو تراجع عن المسودة' : 'لا توجد تغييرات معلقة',
      tone: isDirty ? 'gold' : 'green',
    },
    {
      label: 'الجلسة والصلاحيات',
      value: metadataMismatch ? 'تحتاج مراجعة' : hasAuthorization ? 'صالحة' : 'غير متاحة',
      helper: metadataMismatch ? 'بيانات الدور لا تطابق العقد المتوقع' : 'الوصول يعكس الجلسة الحالية فقط',
      tone: metadataMismatch ? 'gold' : hasAuthorization ? 'green' : 'gray',
    },
  ] as const;
}
