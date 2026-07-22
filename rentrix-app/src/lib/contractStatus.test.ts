import { describe, expect, it } from 'vitest';
import { getContractStatusVariants, isContractStatus, normalizeContractStatus } from './contractStatus';

describe('normalizeContractStatus', () => {
  it('passes modern lowercase statuses through unchanged', () => {
    expect(normalizeContractStatus('draft')).toBe('draft');
    expect(normalizeContractStatus('active')).toBe('active');
    expect(normalizeContractStatus('expired')).toBe('expired');
    expect(normalizeContractStatus('terminated')).toBe('terminated');
  });

  it('maps legacy uppercase spellings onto the canonical lowercase status', () => {
    // Live rows may carry 'ACTIVE'/'ENDED' — the CHECK constraint in
    // 20250101000001_core_schema.sql explicitly allows both spellings.
    expect(normalizeContractStatus('ACTIVE')).toBe('active');
    expect(normalizeContractStatus('ENDED')).toBe('expired');
    expect(normalizeContractStatus('Active')).toBe('active');
    expect(normalizeContractStatus('  ACTIVE  ')).toBe('active');
  });

  it('falls back to draft for empty or unknown values so UI never renders blanks', () => {
    expect(normalizeContractStatus('')).toBe('draft');
    expect(normalizeContractStatus(null)).toBe('draft');
    expect(normalizeContractStatus(undefined)).toBe('draft');
    expect(normalizeContractStatus('archived')).toBe('draft');
  });
});

describe('getContractStatusVariants', () => {
  it('returns every stored spelling for server-side filters', () => {
    expect(getContractStatusVariants('draft')).toEqual(['draft']);
    expect(getContractStatusVariants('active')).toEqual(['active', 'ACTIVE']);
    expect(getContractStatusVariants('expired')).toEqual(['expired', 'ENDED']);
    expect(getContractStatusVariants('terminated')).toEqual(['terminated']);
  });

  it('resolves variants from legacy input spellings too', () => {
    expect(getContractStatusVariants('ACTIVE')).toEqual(['active', 'ACTIVE']);
    expect(getContractStatusVariants('ENDED')).toEqual(['expired', 'ENDED']);
  });
});

describe('isContractStatus', () => {
  it('matches across casings', () => {
    expect(isContractStatus('ACTIVE', 'active')).toBe(true);
    expect(isContractStatus('ENDED', 'expired')).toBe(true);
    expect(isContractStatus('active', 'active')).toBe(true);
  });

  it('rejects different statuses', () => {
    expect(isContractStatus('ACTIVE', 'expired')).toBe(false);
    expect(isContractStatus('terminated', 'draft')).toBe(false);
    expect(isContractStatus('ENDED', 'terminated')).toBe(false);
  });
});
