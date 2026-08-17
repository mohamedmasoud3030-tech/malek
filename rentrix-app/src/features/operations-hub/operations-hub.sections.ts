import { BriefcaseBusiness, FolderKanban, Wrench, Zap } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';

export type OperationsHubSectionId =
  | 'maintenance'
  | 'service_providers'
  | 'utilities'
  | 'documents_vault';

export type OperationsHubSection = SectionTabItem<OperationsHubSectionId> & Readonly<{
  description: string;
  /** null means no extra permission is required beyond being authenticated. */
  permission: 'maintenance.view' | 'service_providers.view' | null;
}>;

/**
 * Services owns day-to-day property operations only: maintenance, providers,
 * utilities and operational documents. Automation is an administrative
 * capability and belongs to Settings; keeping it here as well created two
 * competing authorities for the same task.
 */
export const operationsHubSections: readonly OperationsHubSection[] = [
  {
    id: 'maintenance',
    label: 'الصيانة',
    icon: Wrench,
    description: 'طلبات الصيانة والمتابعة حسب الحالة والأولوية والعقار.',
    permission: 'maintenance.view',
  },
  {
    id: 'service_providers',
    label: 'مزودو الخدمات',
    icon: BriefcaseBusiness,
    description: 'المزودون وتخصصاتهم وبيانات التواصل والأعمال المرتبطة.',
    permission: 'service_providers.view',
  },
  {
    id: 'utilities',
    label: 'المرافق والعدادات',
    icon: Zap,
    description: 'عدادات الكهرباء والمياه وفواتير المرافق وقراءاتها.',
    permission: null,
  },
  {
    id: 'documents_vault',
    label: 'المستندات التشغيلية',
    icon: FolderKanban,
    description: 'المستندات والمرفقات المرتبطة بالتشغيل في تخزين خاص وآمن.',
    permission: null,
  },
] as const;

export type OperationsHubPermission = Exclude<OperationsHubSection['permission'], null>;

export function getVisibleOperationsHubSections(
  canAccess: (permission: OperationsHubPermission) => boolean,
) {
  return operationsHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}
