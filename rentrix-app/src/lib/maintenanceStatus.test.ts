import { describe, expect, it } from 'vitest';
import {
  getMaintenanceStatusVariants,
  normalizeMaintenancePriority,
  normalizeMaintenanceStatus,
} from './maintenanceStatus';

describe('normalizeMaintenanceStatus', () => {
  it('keeps the canonical lowercase statuses', () => {
    expect(normalizeMaintenanceStatus('open')).toBe('open');
    expect(normalizeMaintenanceStatus('in_progress')).toBe('in_progress');
    expect(normalizeMaintenanceStatus('resolved')).toBe('resolved');
    expect(normalizeMaintenanceStatus('closed')).toBe('closed');
    expect(normalizeMaintenanceStatus('cancelled')).toBe('cancelled');
  });

  it('normalizes legacy synonyms to the canonical statuses', () => {
    expect(normalizeMaintenanceStatus('completed')).toBe('resolved');
    expect(normalizeMaintenanceStatus('new')).toBe('open');
    expect(normalizeMaintenanceStatus('reported')).toBe('open');
    expect(normalizeMaintenanceStatus('assigned')).toBe('open');
  });

  it('never presents called-off work (cancelled) as done', () => {
    // R8: Cancelled ≠ Closed. A cancelled work order must not read as resolved or closed.
    expect(normalizeMaintenanceStatus('cancelled')).not.toBe('closed');
    expect(normalizeMaintenanceStatus('cancelled')).not.toBe('resolved');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(normalizeMaintenanceStatus('  CLOSED  ')).toBe('closed');
    expect(normalizeMaintenanceStatus('In_Progress')).toBe('in_progress');
  });

  it('fails safe to open for unknown, empty and non-string input', () => {
    expect(normalizeMaintenanceStatus('garbage')).toBe('open');
    expect(normalizeMaintenanceStatus('')).toBe('open');
    expect(normalizeMaintenanceStatus(null)).toBe('open');
    expect(normalizeMaintenanceStatus(undefined)).toBe('open');
    expect(normalizeMaintenanceStatus({})).toBe('open');
  });
});

describe('normalizeMaintenancePriority', () => {
  it('keeps the canonical priorities', () => {
    expect(normalizeMaintenancePriority('low')).toBe('low');
    expect(normalizeMaintenancePriority('medium')).toBe('medium');
    expect(normalizeMaintenancePriority('high')).toBe('high');
    expect(normalizeMaintenancePriority('urgent')).toBe('urgent');
  });

  it('normalizes legacy synonyms', () => {
    expect(normalizeMaintenancePriority('normal')).toBe('medium');
  });

  it('fails safe to medium for unknown, empty and non-string input', () => {
    expect(normalizeMaintenancePriority('critical')).toBe('medium');
    expect(normalizeMaintenancePriority('')).toBe('medium');
    expect(normalizeMaintenancePriority(null)).toBe('medium');
    expect(normalizeMaintenancePriority(undefined)).toBe('medium');
  });
});

describe('getMaintenanceStatusVariants', () => {
  it('returns the status and its uppercase form', () => {
    expect(getMaintenanceStatusVariants('closed')).toEqual(['closed', 'CLOSED']);
  });
});
