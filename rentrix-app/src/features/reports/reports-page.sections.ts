import { AlertTriangle, BarChart3, Building2, ClipboardList, FileSpreadsheet, Layers, Scale, WalletCards, Wrench } from 'lucide-react';

export const reportSections = [
  {
    id: 'overview',
    label: 'نظرة عامة',
    icon: BarChart3,
    group: 'تنفيذي',
    description: 'ملخص السيولة والإشغال وكفاءة التحصيل وأحدث الحركات في قراءة واحدة.',
  },
  {
    id: 'property_analytics',
    label: 'العقارات',
    icon: Building2,
    group: 'تشغيلي',
    description: 'أداء كل عقار من حيث الإشغال والشواغر والمصروفات التشغيلية.',
  },
  {
    id: 'overdue',
    label: 'المتأخرات',
    icon: AlertTriangle,
    group: 'تحصيل',
    description: 'الفواتير المتأخرة وتعتيق الذمم وأولوية التحصيل حسب العمر والقيمة.',
  },
  {
    id: 'occupancy',
    label: 'الإشغال',
    icon: Building2,
    group: 'تشغيلي',
    description: 'الإشغال والشواغر والعقود القريبة من الانتهاء وفرص إعادة التأجير.',
  },
  {
    id: 'collections',
    label: 'التحصيلات',
    icon: WalletCards,
    group: 'تحصيل',
    description: 'التحصيل اليومي وطرق السداد والإيصالات وسجل العقود الجاري.',
  },
  {
    id: 'expenses',
    label: 'المصروفات',
    icon: ClipboardList,
    group: 'تشغيلي',
    description: 'المصروفات حسب التصنيف والعقار ومتوسط الحركة وتركيز التكلفة.',
  },
  {
    id: 'maintenance_analytics',
    label: 'الصيانة',
    icon: Wrench,
    group: 'تشغيلي',
    description: 'حجم البلاغات وحالات التنفيذ والأولوية والتغطية التشغيلية للفريق.',
  },
  {
    id: 'deferred_revenue',
    label: 'الاستحقاق',
    icon: Layers,
    group: 'محاسبي',
    description: 'التحصيلات المقدمة المرتبطة بالعقود وجدول الاعتراف بالإيراد والالتزام المؤجل.',
  },
  {
    id: 'statements',
    label: 'الكشوف',
    icon: FileSpreadsheet,
    group: 'كشوف',
    description: 'كشف المستأجر والمالك وحركة المكتب والتدفق النقدي والضريبة.',
  },
  {
    id: 'accounting',
    label: 'المحاسبة',
    icon: Scale,
    group: 'محاسبي',
    description: 'ميزان المراجعة والدخل والمركز المالي من مصادر القيود المحاسبية المعتمدة.',
  },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];
