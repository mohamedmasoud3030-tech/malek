import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree } from 'lucide-react';

export const settingsSections = [
  {
    id: 'office',
    label: 'بيانات المكتب',
    description: 'هوية المكتب وبيانات التواصل والعنوان.',
    icon: Building2,
  },
  {
    id: 'identity',
    label: 'الهوية والطباعة',
    description: 'العملة واللغة والشعار وصيغ العرض.',
    icon: FileSignature,
  },
  {
    id: 'documents',
    label: 'المستندات والضريبة',
    description: 'بادئات المستندات والبيانات الضريبية المرجعية؛ السياسة الضريبية الفعلية تُحسم من السلطات المعتمدة حسب التاريخ.',
    icon: FileSignature,
  },
  {
    id: 'cost-centers',
    label: 'مراكز التكلفة',
    description: 'تصنيف المصروفات والتقارير تشغيلياً.',
    icon: FolderTree,
  },
  {
    id: 'payment-terms',
    label: 'شروط السداد',
    description: 'قوالب جداول السداد المستخدمة في العقود.',
    icon: CalendarClock,
  },
  {
    id: 'notifications',
    label: 'الإشعارات والتنبيهات',
    description: 'قنوات المتابعة المسجلة للمكتب.',
    icon: Bell,
  },
  {
    id: 'system',
    label: 'المظهر والواجهة',
    description: 'السمة ولغة الواجهة ومعاينة الأسطح.',
    icon: Cog,
  },
] as const;

export type SettingsSectionId = (typeof settingsSections)[number]['id'];
