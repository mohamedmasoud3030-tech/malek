import type { CompanySettingsDraft } from '@/features/settings/settingsForm';

export type OfficeReadinessItem = Readonly<{
  id: 'office-identity' | 'contact' | 'localization' | 'documents';
  label: string;
  ready: boolean;
  helper: string;
}>;

export type OfficeReadiness = Readonly<{
  items: readonly OfficeReadinessItem[];
  completed: number;
  total: number;
  percent: number;
  ready: boolean;
  nextAction: string | null;
}>;

function hasContact(draft: CompanySettingsDraft) {
  return Boolean((draft.phone ?? '').trim() || (draft.email ?? '').trim());
}

export function deriveOfficeReadiness(draft: CompanySettingsDraft): OfficeReadiness {
  const items: readonly OfficeReadinessItem[] = [
    {
      id: 'office-identity',
      label: 'هوية المكتب',
      ready: Boolean(draft.company_name.trim() && draft.country && draft.city.trim()),
      helper: 'اسم المكتب والدولة والمدينة',
    },
    {
      id: 'contact',
      label: 'قناة تواصل',
      ready: hasContact(draft),
      helper: 'هاتف أو بريد إلكتروني واحد على الأقل',
    },
    {
      id: 'localization',
      label: 'إعداد التشغيل المحلي',
      ready: Boolean(draft.currency && draft.locale && draft.timezone && draft.date_format && draft.number_format),
      helper: 'العملة واللغة والمنطقة الزمنية وصيغ العرض',
    },
    {
      id: 'documents',
      label: 'ترقيم المستندات',
      ready: Boolean(draft.invoice_prefix.trim() && draft.contract_prefix.trim() && draft.receipt_prefix.trim()),
      helper: 'بادئات الفاتورة والعقد والإيصال',
    },
  ];
  const completed = items.filter((item) => item.ready).length;
  const total = items.length;
  const next = items.find((item) => !item.ready) ?? null;
  return {
    items,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    ready: completed === total,
    nextAction: next?.label ?? null,
  };
}
