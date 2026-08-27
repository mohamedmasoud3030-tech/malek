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
  showInPrimaryNavigation: boolean;
}>;

/**
 * Services keeps daily navigation focused on maintenance and utilities. Provider
 * and document registers remain available when reached from contextual/deep-link
 * flows, without competing for space in the routine workspace.
 */
export const operationsHubSections: readonly OperationsHubSection[] = [
  {
    id: 'maintenance',
    label: 'الصيانة',
    icon: Wrench,
    description: 'طلبات الصيانة والمتابعة حسب الحالة والأولوية والعقار.',
    permission: 'maintenance.view',
    showInPrimaryNavigation: true,
  },
  {
    id: 'service_providers',
    label: 'مزودو الخدمات',
    icon: BriefcaseBusiness,
    description: 'المزودون وتخصصاتهم وبيانات التواصل والأعمال المرتبطة.',
    permission: 'service_providers.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'utilities',
    label: 'المرافق والعدادات',
    icon: Zap,
    description: 'عدادات الكهرباء والمياه وفواتير المرافق وقراءاتها.',
    permission: null,
    showInPrimaryNavigation: true,
  },
  {
    id: 'documents_vault',
    label: 'المستندات التشغيلية',
    icon: FolderKanban,
    description: 'المستندات والمرفقات المرتبطة بالتشغيل.',
    permission: null,
    showInPrimaryNavigation: false,
  },
] as const;

export type OperationsHubPermission = Exclude<OperationsHubSection['permission'], null>;

export function getAccessibleOperationsHubSections(
  canAccess: (permission: OperationsHubPermission) => boolean,
) {
  return operationsHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}

export function getVisibleOperationsHubSections(
  canAccess: (permission: OperationsHubPermission) => boolean,
) {
  return getAccessibleOperationsHubSections(canAccess).filter((section) => section.showInPrimaryNavigation);
}
