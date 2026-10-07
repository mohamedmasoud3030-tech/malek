import { describe, expect, it } from 'vitest';
import { unitStatusTones, unitStatusToneFor, unitStatusValues } from './unit-schema';

describe('canonical unit status semantics', () => {
  it('keeps one tone per canonical status with available as the only rentable vacancy', () => {
    expect(unitStatusTones).toEqual({
      available: 'success',
      occupied: 'info',
      maintenance: 'warning',
      reserved: 'neutral',
    });
    // maintenance/reserved must never present as rentable vacancy (success).
    expect(unitStatusTones.maintenance).not.toBe('success');
    expect(unitStatusTones.reserved).not.toBe('success');
    for (const status of unitStatusValues) {
      expect(unitStatusToneFor(status)).toBe(unitStatusTones[status]);
    }
  });

  it('normalizes legacy raw statuses and degrades unknown values safely', () => {
    expect(unitStatusToneFor('rented')).toBe('info');
    expect(unitStatusToneFor('OCCUPIED')).toBe('info');
    expect(unitStatusToneFor('corrupted-status')).toBe('neutral');
  });
});
