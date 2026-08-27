import { ContactRound, FileText, MessageSquareText, UserCheck, Users } from 'lucide-react';
import type { SectionTabItem } from '@/components/ui/section-tabs';
import type { AppPermission } from '@/features/auth/permissions';

export type LeasingHubSectionId = 'contracts' | 'tenants' | 'people' | 'leads' | 'communication';

export type LeasingHubSection = SectionTabItem<LeasingHubSectionId> & Readonly<{
  description: string;
  permission: AppPermission | null;
  showInPrimaryNavigation: boolean;
}>;

/**
 * Leasing keeps the daily journey focused on contracts and tenants. Supporting
 * relationship registers remain permission-guarded and deep-link addressable.
 */
export const leasingHubSections: readonly LeasingHubSection[] = [
  {
    id: 'contracts',
    label: 'العقود',
    icon: FileText,
    description: 'إنشاء العقود واعتمادها وتفعيلها وتجديدها وإنهاؤها.',
    permission: null,
    showInPrimaryNavigation: true,
  },
  {
    id: 'tenants',
    label: 'المستأجرون',
    icon: UserCheck,
    description: 'المستأجرون وعلاقتهم بالوحدات والعقود والمتأخرات.',
    permission: null,
    showInPrimaryNavigation: true,
  },
  {
    id: 'people',
    label: 'جهات التعامل',
    icon: Users,
    description: 'دليل الأطراف التي تدخل في دورة التأجير والتعامل.',
    permission: null,
    showInPrimaryNavigation: false,
  },
  {
    id: 'leads',
    label: 'العملاء المحتملون',
    icon: ContactRound,
    description: 'الفرص قبل التعاقد ومتابعة تحويلها إلى علاقة إيجارية.',
    permission: 'leads.view',
    showInPrimaryNavigation: false,
  },
  {
    id: 'communication',
    label: 'التواصل',
    icon: MessageSquareText,
    description: 'المتابعات والتواصل المرتبط بالأطراف ودورة التأجير.',
    permission: 'communication.view',
    showInPrimaryNavigation: false,
  },
] as const;

export function isLeasingHubSectionId(value: unknown): value is LeasingHubSectionId {
  return typeof value === 'string' && leasingHubSections.some((section) => section.id === value);
}
