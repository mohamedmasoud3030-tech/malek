import { Bell, Building2, CalendarClock, Cog, FileSignature, FolderTree, ShieldCheck } from 'lucide-react';

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
    label: 'العقود والفواتير',
    description: 'بادئات المستندات وإعدادات VAT.',
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
    id: 'security',
    label: 'الأمان والحساب',
    description: 'الجلسة الحالية والدور وتغيير كلمة المرور.',
    icon: ShieldCheck,
  },
  {
    id: 'role-simulator',
    label: 'محاكي الصلاحيات',
    description: 'اختبار سلوك الأدوار الحالية دون تغيير العقود.',
    icon: Cog,
  },
  {
    id: 'system',
    label: 'المظهر والواجهة',
    description: 'السمة ولغة الواجهة ومعاينة الأسطح.',
    icon: Cog,
  },
] as const;

export type SettingsSectionId = (typeof settingsSections)[number]['id'];
