import { describe, expect, it } from 'vitest';
import { normalizeUnitStatus } from '@/features/units/unit-schema';

describe('unit status compatibility', () => {
  it('normalizes legacy uppercase values returned by Supabase', () => {
    expect(normalizeUnitStatus('AVAILABLE')).toBe('available');
    expect(normalizeUnitStatus(' OCCUPIED ')).toBe('occupied');
  });

  it('keeps canonical values unchanged', () => {
    expect(normalizeUnitStatus('maintenance')).toBe('maintenance');
    expect(normalizeUnitStatus('reserved')).toBe('reserved');
  });

  it('rejects unsupported values instead of silently misclassifying units', () => {
    expect(() => normalizeUnitStatus('unknown')).toThrow('Unsupported unit status: unknown');
  });
});
