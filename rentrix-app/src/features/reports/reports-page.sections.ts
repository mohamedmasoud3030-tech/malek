import { AlertTriangle, BarChart3, Building2, ClipboardList, FileSpreadsheet, Scale, WalletCards } from 'lucide-react';

// Each section is anchored by id and answers one specific business question.
// "كشوف الحساب" keeps honest statement wording and avoids ledger/final-settlement claims.
export const reportSections = [
  { id: 'overview', label: 'نظرة عامة', icon: BarChart3 },
  { id: 'collections', label: 'التحصيلات', icon: WalletCards },
  { id: 'overdue', label: 'المتأخرات', icon: AlertTriangle },
  { id: 'expenses', label: 'المصروفات', icon: ClipboardList },
  { id: 'occupancy', label: 'الإشغال والعقود', icon: Building2 },
  { id: 'accounting', label: 'محاسبة', icon: Scale },
  { id: 'statements', label: 'كشوف الحساب', icon: FileSpreadsheet },
  { id: 'metrics', label: 'المؤشرات الرئيسية', icon: BarChart3 },
] as const;

export type ReportSectionId = (typeof reportSections)[number]['id'];
