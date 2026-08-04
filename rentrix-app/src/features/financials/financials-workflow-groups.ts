import { FileCheck, Landmark, ReceiptText, WalletCards, type LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

/**
 * Operational workflow groups shown on the /financials summary.
 *
 * /financials is intentionally NOT a directory that duplicates every
 * destination already available in the finance hub navigation. Instead it
 * groups the daily-money workflows into a small number of meaningful workflow
 * groups, each of which opens the correct finance hub entry route directly.
 *
 * The sub-destinations are rendered purely as descriptive chips (never as
 * full duplicate card grids or duplicate lists from the destination page) so
 * the summary stays a summary.
 */
export type FinancialWorkflowGroup = Readonly<{
  id: string;
  route: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Sub-destination chips shown in display order, each with its own guard. */
  destinations: readonly Readonly<{ label: string; permission: AppPermission | null }>[];
  /** Any permission required to reach the group's route. */
  permission: AppPermission | null;
}>;

export const financialWorkflowGroups: readonly FinancialWorkflowGroup[] = [
  {
    id: 'collections',
    route: '/finance/collections',
    title: 'التحصيل اليومي',
    description: 'الفواتير المستحقة وتسجيل دفعاتها، وسجل الإيصالات وطباعة سندات القبض.',
    icon: ReceiptText,
    destinations: [
      { label: 'الفواتير', permission: null },
      { label: 'التحصيل والإيصالات', permission: null },
    ],
    permission: null,
  },
  {
    id: 'expenses-arrears',
    route: '/finance/expenses',
    title: 'المصروفات والذمم',
    description: 'تسجيل ومراجعة نفقات العقارات، ومتابعة الذمم المتأخرة وأعمار الديون.',
    icon: WalletCards,
    destinations: [
      { label: 'المصروفات التشغيلية', permission: 'expenses.view' },
      { label: 'المتأخرات والديون', permission: 'arrears.view' },
    ],
    permission: 'expenses.view',
  },
  {
    id: 'deposits-settlements',
    route: '/finance/deposits',
    title: 'تسويات وضمانات',
    description: 'تأمينات المستأجرين المحتجزة، وتسويات الملاك المُعدّة والمعتمدة للصرف.',
    icon: FileCheck,
    destinations: [
      { label: 'تأمين وأمانات المستأجرين', permission: 'financial.deposits.view' },
      { label: 'تسويات الملاك', permission: 'financial.owner_settlements.view' },
    ],
    permission: 'financial.deposits.view',
  },
  {
    id: 'banking-commissions',
    route: '/finance/banking',
    title: 'البنوك والعمولات',
    description: 'مطابقة السجلات مع الحسابات البنكية، ومتابعة عمولات المكتب وحالات استحقاقها.',
    icon: Landmark,
    destinations: [
      { label: 'مطابقة كشف البنك', permission: 'financial.bank_reconciliation.view' },
      { label: 'عمولات المكتب', permission: 'commissions.view' },
    ],
    permission: 'financial.bank_reconciliation.view',
  },
];
