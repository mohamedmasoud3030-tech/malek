import { describe, expect, it } from 'vitest';
import { businessReferenceOrLabel, getBusinessReference } from './business-reference';

const uuidV4 = '123e4567-e89b-12d3-a456-426614174000';

describe('getBusinessReference', () => {
  it('returns the stored human business reference', () => {
    expect(getBusinessReference({ reference: 'INV-2026-0001' })).toBe('INV-2026-0001');
  });

  it('never falls back to an internal UUID id', () => {
    expect(getBusinessReference({ reference: uuidV4 })).toBeNull();
  });

  it('falls through to the next real reference field when the first is an internal id', () => {
    expect(getBusinessReference({ reference: uuidV4, contract_number: 'CON-00042' })).toBe('CON-00042');
  });

  it('prefers the canonical field order', () => {
    const record = { receipt_number: 'REC-9', invoice_number: 'INV-8', reference: 'REF-7' };
    expect(getBusinessReference(record)).toBe('REF-7');
  });

  it('trims surrounding whitespace', () => {
    expect(getBusinessReference({ reference: '  INV-0007  ' })).toBe('INV-0007');
  });

  it('ignores non-string fields', () => {
    expect(getBusinessReference({ reference: 42, invoice_number: 'INV-0008' })).toBe('INV-0008');
  });

  it('returns null for null or undefined records', () => {
    expect(getBusinessReference(null)).toBeNull();
    expect(getBusinessReference(undefined)).toBeNull();
  });

  it('returns null when every field is empty or an internal id', () => {
    expect(getBusinessReference({ reference: '', invoice_number: uuidV4, plot_no: '  ' })).toBeNull();
  });
});

describe('businessReferenceOrLabel', () => {
  it('returns the reference when one exists', () => {
    expect(businessReferenceOrLabel({ reference: 'INV-0001' }, 'بدون مرجع')).toBe('INV-0001');
  });

  it('falls back to the provided label when no business reference exists', () => {
    expect(businessReferenceOrLabel({ reference: uuidV4 }, 'بدون مرجع')).toBe('بدون مرجع');
    expect(businessReferenceOrLabel(null, '—')).toBe('—');
  });
});
