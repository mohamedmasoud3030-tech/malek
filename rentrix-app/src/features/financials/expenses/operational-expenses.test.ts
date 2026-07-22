import { describe, expect, it } from 'vitest';
import type { Expense, Property } from '@/types/domain';
import { buildExpenseCategoryOptions, buildExpensePropertyLabel, getExpenseChargedTo, getExpenseChargedToLabel, normalizeExpenseChargedTo, summarizeOperationalExpenses } from './operational-expenses';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    property_id: 'property-1',
    category: 'صيانة',
    amount: 100,
    expense_date: '2026-05-18',
    cost_center_id: null,
    description: null,
    attachment_url: null,
    created_at: '2026-05-18T00:00:00.000Z',
    updated_at: '2026-05-18T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('operational expenses helpers', () => {
  it('returns property title as expense property label when available', () => {
    const expense = makeExpense();
    const propertyMap = new Map<string, Property>([
      [
        expense.property_id,
        {
          id: expense.property_id,
          title: 'برج النخبة',
          address: 'الرياض',
          type: 'building',
          owner_name: null,
          purchase_value: null,
          current_value: null,
          status: 'active',
          notes: null,
          created_at: '2026-05-18T00:00:00.000Z',
          updated_at: '2026-05-18T00:00:00.000Z',
          deleted_at: null,
        },
      ],
    ]);

    expect(buildExpensePropertyLabel(expense, propertyMap)).toBe('برج النخبة');
  });

  it('falls back to unknown property label when title does not exist', () => {
    const expense = makeExpense({ property_id: 'missing-property' });
    const propertyMap = new Map<string, Property>();

    expect(buildExpensePropertyLabel(expense, propertyMap)).toBe('عقار غير معروف');
  });

  it('summarizes visible expense totals and distinct counters', () => {
    const expenses: Expense[] = [
      makeExpense({ id: 'expense-1', property_id: 'property-1', category: 'صيانة', amount: 200 }),
      makeExpense({ id: 'expense-2', property_id: 'property-1', category: 'مرافق', amount: 150 }),
      makeExpense({ id: 'expense-3', property_id: 'property-2', category: 'صيانة', amount: 50 }),
    ];

    expect(summarizeOperationalExpenses(expenses)).toEqual({
      visibleCount: 3,
      visibleAmount: 400,
      byPropertyCount: 2,
      byCategoryCount: 2,
    });
  });
});

describe('expense charged_to helpers', () => {
  it('reads charged_to defensively from the operational write fields', () => {
    expect(getExpenseChargedTo(makeExpense())).toBeNull();
    expect(getExpenseChargedTo(makeExpense() as never)).toBeNull();
    const charged = { ...makeExpense(), charged_to: 'OWNER' } as never;
    expect(getExpenseChargedTo(charged)).toBe('OWNER');
  });

  it('normalizes stored casings onto the canonical enum values', () => {
    expect(normalizeExpenseChargedTo('OWNER')).toBe('OWNER');
    expect(normalizeExpenseChargedTo('owner')).toBe('OWNER');
    expect(normalizeExpenseChargedTo(' tenant ')).toBe('TENANT');
    expect(normalizeExpenseChargedTo(null)).toBe('COMPANY');
    expect(normalizeExpenseChargedTo('')).toBe('COMPANY');
    expect(normalizeExpenseChargedTo('CARRIER')).toBe('COMPANY');
  });

  it('labels every canonical value in Arabic', () => {
    expect(getExpenseChargedToLabel('OWNER')).toBe('المالك');
    expect(getExpenseChargedToLabel('TENANT')).toBe('المستأجر');
    expect(getExpenseChargedToLabel('COMPANY')).toBe('الشركة');
    expect(getExpenseChargedToLabel(undefined)).toBe('الشركة');
  });
});

describe('buildExpenseCategoryOptions', () => {
  it('keeps canonical categories first and appends observed legacy values', () => {
    const rows = [
      makeExpense({ category: 'صيانة' }),
      makeExpense({ id: 'expense-2', category: 'كهرباء قديمة' }),
      makeExpense({ id: 'expense-3', category: 'مرافق' }),
    ];

    const options = buildExpenseCategoryOptions(rows);

    expect(options.slice(0, 5)).toEqual(['صيانة', 'مرافق', 'إدارية', 'تأمين', 'أخرى']);
    expect(options).toContain('كهرباء قديمة');
    expect(options.indexOf('كهرباء قديمة')).toBeGreaterThan(4);
  });

  it('does not duplicate canonical categories that appear in the data', () => {
    const options = buildExpenseCategoryOptions([makeExpense({ category: 'صيانة' })]);
    expect(options.filter((category) => category === 'صيانة')).toHaveLength(1);
  });
});
