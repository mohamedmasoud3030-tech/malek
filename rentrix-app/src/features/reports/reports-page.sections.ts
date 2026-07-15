import { AlertTriangle, BarChart3, Building2, ClipboardList, FileSpreadsheet, Scale, WalletCards } from 'lucide-react';

export const reportSections = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'overdue', label: 'المتأخرات والديون', icon: AlertTriangle },
  { id: 'occupancy', label: 'الإشغال والشواغر', icon: Building2 },
  { id: 'collections', label: 'التحصيلات والتدفقات', icon: WalletCards },
  { id: 'expenses', label: 'المصروفات والتكاليف', icon: ClipboardList },
  { id: 'statements', label: 'كشوف الحسابات المعتمدة', icon: FileSpreadsheet },
  { id: 'accounting', label: 'القوائم المحاسبية', icon: Scale },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];
