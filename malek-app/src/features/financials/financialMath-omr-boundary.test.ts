import { describe, expect, it } from 'vitest';
import { getSafeRemainingAmount, sumFinancialValues } from './financialMath';

/**
 * OMR has 3 decimals (1 OMR = 1000 baisa). These cases pin the boundary values
 * where plain binary float arithmetic drifts, so the shared finance primitives
 * stay aligned with the server `numeric(18,3)` / `_r3` contract.
 */
describe('financialMath OMR 3-decimal boundaries', () => {
  it('removes binary float drift from sums', () => {
    expect(sumFinancialValues([0.1, 0.2])).toBe(0.3);
    expect(sumFinancialValues(Array.from({ length: 1000 }, () => 0.001))).toBe(1);
    expect(sumFinancialValues([33.333, 33.333, 33.334])).toBe(100);
  });

  it('keeps one-baisa amounts exact', () => {
    expect(sumFinancialValues(['1234.567', 0.001])).toBe(1234.568);
  });

  it('removes binary float drift from remaining amounts', () => {
    expect(getSafeRemainingAmount(0.3, 0.1)).toBe(0.2);
  });

  it('never returns a negative remaining amount at the boundary', () => {
    expect(getSafeRemainingAmount(0.1, 0.3)).toBe(0);
  });

  it('never returns negative zero', () => {
    expect(sumFinancialValues([])).toBe(0);
    expect(sumFinancialValues([-0.0001])).toBe(0);
  });
});
