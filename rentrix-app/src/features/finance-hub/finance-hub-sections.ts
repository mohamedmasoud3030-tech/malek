import { BadgeDollarSign, ClipboardList, FileCheck, FileSpreadsheet, HandCoins, Landmark, ReceiptText, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPermission } from '@/features/auth/permissions';

/**
 * Stable identifiers for every finance workspace section.
 *
 * These values are part of the public URL contract (`?section=<id>`), so they
 * must never be renamed without a redirect: bookmarks and deep links depend on
 * them.
 */
export const financeHubSectionIds = [
  'invoices',
  'receipts',
  'expenses',
  'arrears',
  'deposits',
  'owner_settlements',
  'bank_reconciliation',
  'commissions',
] as const;

export type FinanceHubSectionId = (typeof financeHubSectionIds)[number];

export type FinanceHubSection = Readonly<{
  id: FinanceHubSectionId;
  label: string;
  icon: LucideIcon;
  /**
   * The permission a user must hold to see this tab.
   *
   * `null` means "no dedicated permission" — the section inherits the
   * authenticated-only contract the standalone route had before the hub merge.
   * This mirrors the pre-merge route guards exactly (see
   * `finance-hub-permissions.test.ts`), so the hub can never surface a section
   * that was previously unreachable.
   */
  permission: AppPermission | null;
}>;

/**
 * Single source of truth for the finance workspace tab set.
 *
 * The permission column is copied verbatim from the pre-refactor route guards
 * in `app/router/route-tree.ts`:
 *
 *   /invoices             -> (protected only)
 *   /receipts             -> (protected only)
 *   /expenses             -> expenses.view
 *   /arrears              -> arrears.view
 *   /deposits             -> financial.deposits.view
 *   /owner-settlements    -> financial.owner_settlements.view
 *   /bank-reconciliation  -> financial.bank_reconciliation.view
 *   /commissions          -> commissions.view
 */
export const financeHubSections: readonly FinanceHubSection[] = [
  { id: 'invoices', label: 'الفواتير', icon: FileSpreadsheet, permission: null },
  { id: 'receipts', label: 'التحصيل والإيصالات', icon: ReceiptText, permission: null },
  { id: 'expenses', label: 'المصروفات التشغيلية', icon: WalletCards, permission: 'expenses.view' },
  { id: 'arrears', label: 'المتأخرات والديون', icon: ClipboardList, permission: 'arrears.view' },
  { id: 'deposits', label: 'تأمين وأمانات المستأجرين', icon: FileCheck, permission: 'financial.deposits.view' },
  { id: 'owner_settlements', label: 'تسويات الملاك', icon: HandCoins, permission: 'financial.owner_settlements.view' },
  { id: 'bank_reconciliation', label: 'مطابقة كشف البنك', icon: Landmark, permission: 'financial.bank_reconciliation.view' },
  { id: 'commissions', label: 'عمولات المكتب', icon: BadgeDollarSign, permission: 'commissions.view' },
];

const sectionById = new Map<FinanceHubSectionId, FinanceHubSection>(
  financeHubSections.map((section) => [section.id, section]),
);

export function getFinanceHubSection(id: FinanceHubSectionId): FinanceHubSection {
  const section = sectionById.get(id);
  if (!section) throw new Error(`Unknown finance hub section: ${id}`);
  return section;
}

/** Narrows an untrusted URL value (or anything else) to a known section id. */
export function isFinanceHubSectionId(value: unknown): value is FinanceHubSectionId {
  return typeof value === 'string' && sectionById.has(value as FinanceHubSectionId);
}
