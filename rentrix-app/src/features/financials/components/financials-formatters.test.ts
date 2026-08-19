import { describe, expect, it } from 'vitest';
import { formatMoney } from './financials-formatters';

describe('financials-formatters — currency contract', () => {
  it('renders money with the canonical default currency (OMR), never a hard-coded EGP', () => {
    // Regression: formatMoney used to hard-code defaultCurrency='EGP', so every
    // finance surface displayed Egyptian Pound despite company settings = OMR.
    const rendered = formatMoney(12000);
    expect(rendered).toContain('OMR');
    expect(rendered).not.toContain('EGP');
  });

  it('keeps 3-decimal OMR precision from the company formatter contract', () => {
    const rendered = formatMoney(12000);
    // OMR renders 3 fraction digits per the currency precision contract.
    expect(rendered).toContain('12,000.000');
  });
});
