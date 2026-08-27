import { describe, expect, it } from 'vitest';
import { formatMoney, getErrorMessage } from './financials-formatters';

describe('financials-formatters — currency contract', () => {
  it('renders money with the canonical default currency (OMR), never a hard-coded EGP', () => {
    const rendered = formatMoney(12000);
    expect(rendered).toContain('OMR');
    expect(rendered).not.toContain('EGP');
  });

  it('keeps 3-decimal OMR precision from the company formatter contract', () => {
    const rendered = formatMoney(12000);
    expect(rendered).toContain('12,000.000');
  });
});

describe('financials-formatters — safe product errors', () => {
  it('maps permission failures without exposing database wording', () => {
    const result = getErrorMessage(
      new Error('permission denied for function resolve_active_tax_profile'),
      'تعذر تحميل التقرير.',
    );

    expect(result).toContain('تعذر تحميل التقرير.');
    expect(result).toContain('لا يملك الصلاحية المطلوبة');
    expect(result).not.toContain('permission denied');
    expect(result).not.toContain('resolve_active_tax_profile');
  });

  it('does not echo unknown SQL/provider details', () => {
    const result = getErrorMessage(
      new Error('duplicate key value violates unique constraint ux_private_internal_name'),
      'تعذر تحميل البيانات.',
    );

    expect(result).toBe('تعذر تحميل البيانات.');
    expect(result).not.toContain('unique constraint');
    expect(result).not.toContain('ux_private_internal_name');
  });

  it('preserves actionable Arabic domain messages', () => {
    expect(getErrorMessage(new Error('تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.'), 'تعذر التنفيذ.'))
      .toBe('تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.');
  });

  it('uses the caller fallback when no error exists', () => {
    expect(getErrorMessage(null, 'تعذر تحميل البيانات.')).toBe('تعذر تحميل البيانات.');
  });
});
