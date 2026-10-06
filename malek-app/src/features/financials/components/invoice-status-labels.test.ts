import { describe, expect, it } from 'vitest';
import { getInvoiceStatusVariants, normalizeInvoiceStatus } from './invoice-status-labels';

describe('normalizeInvoiceStatus', () => {
  it('maps modern UPPERCASE statuses to their canonical form', () => {
    expect(normalizeInvoiceStatus('UNPAID')).toBe('unpaid');
    expect(normalizeInvoiceStatus('PARTIALLY_PAID')).toBe('partial');
    expect(normalizeInvoiceStatus('PAID')).toBe('paid');
    expect(normalizeInvoiceStatus('OVERDUE')).toBe('overdue');
    expect(normalizeInvoiceStatus('VOID')).toBe('void');
  });

  it('maps legacy lowercase statuses to the same canonical form', () => {
    expect(normalizeInvoiceStatus('issued')).toBe('unpaid');
    expect(normalizeInvoiceStatus('partial')).toBe('partial');
    expect(normalizeInvoiceStatus('paid')).toBe('paid');
    expect(normalizeInvoiceStatus('overdue')).toBe('overdue');
    expect(normalizeInvoiceStatus('void')).toBe('void');
  });

  it('is resilient to unusual whitespace-less mixed casing and unknown values', () => {
    expect(normalizeInvoiceStatus('Partially_Paid')).toBe('partial');
    expect(normalizeInvoiceStatus('')).toBe('other');
    expect(normalizeInvoiceStatus(null)).toBe('other');
    expect(normalizeInvoiceStatus('mystery')).toBe('other');
  });
});

describe('getInvoiceStatusVariants', () => {
  it('covers every live casing of the requested status', () => {
    expect(getInvoiceStatusVariants('unpaid')).toEqual(['unpaid', 'UNPAID', 'issued']);
    expect(getInvoiceStatusVariants('partial')).toEqual(['partial', 'PARTIALLY_PAID']);
    expect(getInvoiceStatusVariants('overdue')).toEqual(['overdue', 'OVERDUE']);
  });

  it('passes unknown statuses through unchanged', () => {
    expect(getInvoiceStatusVariants('custom_state')).toEqual(['custom_state']);
  });
});
