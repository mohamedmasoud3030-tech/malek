import { AlertTriangle, BarChart3, Building2, ClipboardList, FileSpreadsheet, Layers, Scale, WalletCards, Wrench } from 'lucide-react';

export const reportSections = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'property_analytics', label: 'العقارات', icon: Building2 },
  { id: 'overdue', label: 'المتأخرات', icon: AlertTriangle },
  { id: 'occupancy', label: 'الإشغال', icon: Building2 },
  { id: 'collections', label: 'التحصيلات', icon: WalletCards },
  { id: 'expenses', label: 'المصروفات', icon: ClipboardList },
  { id: 'maintenance_analytics', label: 'الصيانة', icon: Wrench },
  { id: 'deferred_revenue', label: 'الاستحقاق', icon: Layers },
  { id: 'statements', label: 'الكشوف', icon: FileSpreadsheet },
  { id: 'accounting', label: 'المحاسبة', icon: Scale },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];
