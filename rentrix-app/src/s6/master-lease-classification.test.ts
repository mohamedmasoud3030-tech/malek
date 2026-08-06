import { describe, expect, it } from 'vitest';
import { classifyMasterLease } from './master-lease-classification';

describe('classifyMasterLease', () => {
  it('recognizes ordinary leases', () => {
    expect(classifyMasterLease({
      leaseTermMonths: 24,
      purchaseOptionReasonablyCertain: false,
      lowValueExemptionElected: false,
      shortTermExemptionElected: false,
    })).toEqual({
      recognitionRequired: true,
      exemption: 'none',
      reason: 'ROU asset and lease liability recognition required',
    });
  });

  it('allows the short-term exemption only when eligible', () => {
    expect(classifyMasterLease({
      leaseTermMonths: 12,
      purchaseOptionReasonablyCertain: false,
      lowValueExemptionElected: false,
      shortTermExemptionElected: true,
    }).exemption).toBe('short_term');

    expect(classifyMasterLease({
      leaseTermMonths: 12,
      purchaseOptionReasonablyCertain: true,
      lowValueExemptionElected: false,
      shortTermExemptionElected: true,
    }).recognitionRequired).toBe(true);
  });

  it('supports a low-value policy election', () => {
    expect(classifyMasterLease({
      leaseTermMonths: 36,
      purchaseOptionReasonablyCertain: false,
      lowValueExemptionElected: true,
      shortTermExemptionElected: false,
    }).exemption).toBe('low_value');
  });

  it('rejects invalid lease terms', () => {
    expect(() => classifyMasterLease({
      leaseTermMonths: 0,
      purchaseOptionReasonablyCertain: false,
      lowValueExemptionElected: false,
      shortTermExemptionElected: false,
    })).toThrow('leaseTermMonths');
  });
});
