// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaxDefinitionFields } from './tax-profile-workspace';

afterEach(cleanup);

const draft = {
  tax_code: 'VAT',
  tax_rate: 5,
  effective_from: '2026-01-01',
  effective_to: '',
  description: '',
};
const taxCodes = [{ code: 'VAT', name_ar: 'ضريبة القيمة المضافة' }];

describe('TaxDefinitionFields', () => {
  it('preserves the optional rent-tax end date and shared fields', () => {
    render(
      <TaxDefinitionFields
        draft={draft}
        setDraft={vi.fn()}
        taxCodes={taxCodes}
        includeEffectiveTo
      />,
    );

    expect(screen.getByLabelText('نوع الضريبة *')).toBeTruthy();
    expect(screen.getByLabelText('النسبة % *')).toBeTruthy();
    expect(screen.getByLabelText('سارٍ من *')).toBeTruthy();
    expect(screen.getByLabelText('سارٍ إلى (اختياري)')).toBeTruthy();
    expect(screen.getByLabelText('ملاحظة')).toBeTruthy();
  });

  it('keeps the fee-tax form without an end-date control', () => {
    render(<TaxDefinitionFields draft={draft} setDraft={vi.fn()} taxCodes={taxCodes} />);

    expect(screen.getByLabelText('نوع الضريبة *')).toBeTruthy();
    expect(screen.getByLabelText('النسبة % *')).toBeTruthy();
    expect(screen.getByLabelText('سارٍ من *')).toBeTruthy();
    expect(screen.queryByLabelText('سارٍ إلى (اختياري)')).toBeNull();
    expect(screen.getByLabelText('ملاحظة')).toBeTruthy();
  });
});
