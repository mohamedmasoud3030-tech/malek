import { BriefcaseBusiness, Settings2, Wrench, Zap } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';

export type OperationsHubSectionId = 'maintenance' | 'service_providers' | 'utilities' | 'automation';

export type OperationsHubSection = SectionTabItem<OperationsHubSectionId> & Readonly<{
  description: string;
  /** null means no extra permission is required beyond being an authenticated user. */
  permission: 'maintenance.view' | 'service_providers.view' | 'automation.view' | null;
}>;

/**
 * Single source of truth for the operations hub tabs. Mirrors the standalone
 * routes it embeds: /maintenance, /utilities, /automation. Documents are
 * contextual to their owning entity and are intentionally not an operations tab.
 * Permissions here must stay identical to the route-level guards in
 * app/router/route-tree.ts — this file does not grant or widen access, it
 * only decides which already-permitted tab to render/hide.
 */
export const operationsHubSections: readonly OperationsHubSection[] = [
  {
    id: 'maintenance',
    label: 'الصيانة',
    icon: Wrench,
    description: 'تتبع طلبات الصيانة حسب الحالة والأولوية والعقار.',
    permission: 'maintenance.view',
  },
  {
    id: 'service_providers',
    label: 'مزودو الخدمات',
    icon: BriefcaseBusiness,
    description: 'ملفات المزودين وتخصصاتهم وبيانات التواصل وأعمال الصيانة المرتبطة.',
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
    id: 'automation',
    label: 'الأتمتة والتنبيهات',
    icon: Settings2,
    description: 'قواعد الأتمتة وتذكيرات العقود والإيجار وسجل التشغيل.',
    permission: 'automation.view',
  },
] as const;

export type OperationsHubPermission = Exclude<OperationsHubSection['permission'], null>;

/** Returns only tabs accepted by the shared authorization seam. */
export function getVisibleOperationsHubSections(
  canAccess: (permission: OperationsHubPermission) => boolean,
) {
  return operationsHubSections.filter(
    (section) => section.permission === null || canAccess(section.permission),
  );
}
