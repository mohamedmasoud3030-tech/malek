import { FolderKanban, Settings2, Wrench, Zap } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type OperationsHubSectionId = 'maintenance' | 'utilities' | 'automation' | 'documents_vault';

export type OperationsHubSection = SectionTabItem<OperationsHubSectionId> & Readonly<{
  description: string;
  /** null means no extra permission is required beyond being an authenticated user. */
  permission: AppPermission | null;
}>;

/**
 * Single source of truth for the operations hub tabs. Mirrors the standalone
 * routes it embeds: /maintenance, /utilities, /automation, /documents-vault.
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
  {
    id: 'documents_vault',
    label: 'خزينة المستندات',
    icon: FolderKanban,
    description: 'أرشيف المستندات والمرفقات في تخزين خاص وآمن.',
    permission: null,
  },
] as const;
