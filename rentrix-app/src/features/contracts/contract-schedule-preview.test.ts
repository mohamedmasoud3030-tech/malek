import { describe, expect, it } from 'vitest';
import { calculateContractSchedulePreview } from './contract-schedule-preview';

describe('calculateContractSchedulePreview canonical duration contract', () => {
  it('calculates exact monthly installment counts for 6 months, 12 months, and 24 months without hard-coding 12', () => {
    const months6 = calculateContractSchedulePreview('2026-01-01', '2026-06-30', 'monthly', 600);
    expect(months6.installmentCount).toBe(6);
    expect(months6.amountPerInstallment).toBe(100);
    expect(months6.sampleDates).toHaveLength(6);

    const months12 = calculateContractSchedulePreview('2026-01-01', '2026-12-31', 'monthly', 1200);
    expect(months12.installmentCount).toBe(12);

    const months24 = calculateContractSchedulePreview('2026-01-01', '2027-12-31', 'monthly', 2400);
    expect(months24.installmentCount).toBe(24);
  });

  it('calculates exact quarterly and semi-annual installment counts matching lease duration', () => {
    const q1Year = calculateContractSchedulePreview('2026-01-01', '2026-12-31', 'quarterly', 1200);
    expect(q1Year.installmentCount).toBe(4);
    expect(q1Year.sampleDates).toEqual(['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01']);

    const s2Years = calculateContractSchedulePreview('2026-01-01', '2027-12-31', 'semi_annual', 2000);
    expect(s2Years.installmentCount).toBe(4);
  });

  it('returns zero installments for invalid or inverted dates', () => {
    const inverted = calculateContractSchedulePreview('2026-12-31', '2026-01-01', 'monthly', 1000);
    expect(inverted.installmentCount).toBe(0);
  });
});
