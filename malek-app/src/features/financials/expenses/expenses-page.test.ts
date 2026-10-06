import { describe, expect, it } from 'vitest';
import { buildExpensesCsv } from '../components/expenses-section';
import { toLocalDateInputValue } from './expenses-page';
import type { Expense, Property } from '@/types/domain';

describe('expenses page date defaults', () => {
  it('formats date inputs from local calendar parts instead of UTC ISO strings', () => {
    const utcDate = new Date('2026-01-01T01:30:00.000Z');

    const getFullYear = () => 2025;
    const getMonth = () => 11;
    const getDate = () => 31;
    const localDate = Object.assign(utcDate, { getFullYear, getMonth, getDate });

    expect(utcDate.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(toLocalDateInputValue(localDate)).toBe('2025-12-31');
  });
});

describe('buildExpensesCsv', () => {
  it('exports the visible expenses with escaped property labels and descriptions', () => {
    const property = {
      id: 'property-1',
      title: 'برج "النيل"',
    } as Property;
    const expense = {
      id: 'expense-1',
      property_id: 'property-1',
      category: 'صيانة',
      amount: 1250.5,
      expense_date: '2026-06-13',
      description: 'مصعد, دور 2',
      created_at: '2026-06-13T00:00:00.000Z',
      updated_at: '2026-06-13T00:00:00.000Z',
      deleted_at: null,
    } as Expense;

    expect(buildExpensesCsv([expense], [property])).toBe([
      '"التاريخ","العقار","التصنيف","المبلغ","مركز التكلفة","الوصف"',
      '"2026-06-13","برج ""النيل""","صيانة",1250.5,"","مصعد, دور 2"',
    ].join('\n'));
  });

  it('neutralizes spreadsheet formulas in exported text cells', () => {
    const property = { id: 'property-1', title: '=cmd' } as Property;
    const expense = {
      id: 'expense-1',
      property_id: 'property-1',
      category: '@category',
      amount: 20,
      expense_date: '2026-06-13',
      description: ' +SUM(1,2)',
      created_at: '2026-06-13T00:00:00.000Z',
      updated_at: '2026-06-13T00:00:00.000Z',
      deleted_at: null,
    } as Expense;

    expect(buildExpensesCsv([expense], [property])).toContain('"\'=cmd"');
    expect(buildExpensesCsv([expense], [property])).toContain('"\'@category"');
    expect(buildExpensesCsv([expense], [property])).toContain('"\' +SUM(1,2)"');
  });
});
