import type { Expense, Property } from '@/types/domain';

export const OPERATIONAL_EXPENSE_CATEGORIES = ['صيانة', 'مرافق', 'إدارية', 'تأمين', 'أخرى'] as const;

/**
 * Who bears the expense. The DB stores the charged_to_type enum spellings
 * ('OWNER' | 'TENANT' | 'COMPANY' — supabase/migrations/20260705000000), and
 * the owner-statement RPC + owner-balance trigger only see those uppercase
 * values, so the UI must write them exactly.
 */
export const EXPENSE_CHARGED_TO_VALUES = ['COMPANY', 'OWNER', 'TENANT'] as const;

export type ExpenseChargedTo = (typeof EXPENSE_CHARGED_TO_VALUES)[number];

export const EXPENSE_CHARGED_TO_LABELS: Readonly<Record<ExpenseChargedTo, string>> = {
  COMPANY: 'الشركة',
  OWNER: 'المالك',
  TENANT: 'المستأجر',
};

type ExpenseWithOperationalFields = Expense & { charged_to?: string | null };

/**
 * Read charged_to defensively: the generated Expense row type predates the
 * operational write fields (status/charged_to/...), and owner-side SQL
 * readers compare case-insensitively, so normalize any stored casing here.
 */
export function getExpenseChargedTo(expense: Expense): string | null {
  const value = (expense as ExpenseWithOperationalFields).charged_to;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function normalizeExpenseChargedTo(chargedTo: string | null | undefined): ExpenseChargedTo {
  const canonical = (chargedTo ?? '').trim().toUpperCase();
  return (EXPENSE_CHARGED_TO_VALUES as readonly string[]).includes(canonical) ? (canonical as ExpenseChargedTo) : 'COMPANY';
}

export function getExpenseChargedToLabel(chargedTo: string | null | undefined): string {
  return EXPENSE_CHARGED_TO_LABELS[normalizeExpenseChargedTo(chargedTo)];
}

export type OperationalExpenseCategory = (typeof OPERATIONAL_EXPENSE_CATEGORIES)[number];

export type OperationalExpenseFilterValues = {
  propertyId: string;
  category: string;
  costCenterId: string;
  from: string;
  to: string;
};

export type OperationalExpensesSummary = {
  visibleCount: number;
  visibleAmount: number;
  byPropertyCount: number;
  byCategoryCount: number;
};

export function buildExpensePropertyLabel(expense: Expense, propertyById: ReadonlyMap<string, Property>): string {
  const property = propertyById.get(expense.property_id);
  if (property?.title && property.title.trim().length > 0) {
    return property.title;
  }

  return 'عقار غير معروف';
}

export function summarizeOperationalExpenses(expenses: readonly Expense[]): OperationalExpensesSummary {
  const categorySet = new Set<string>();
  const propertySet = new Set<string>();
  let total = 0;

  for (const expense of expenses) {
    total += expense.amount;
    categorySet.add(expense.category);
    propertySet.add(expense.property_id);
  }

  return {
    visibleCount: expenses.length,
    visibleAmount: total,
    byPropertyCount: propertySet.size,
    byCategoryCount: categorySet.size,
  };
}
