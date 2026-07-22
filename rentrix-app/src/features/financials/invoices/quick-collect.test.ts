import { describe, expect, it } from 'vitest';
import {
  createInvoiceCollectHref,
  findNextCollectibleInvoiceId,
  getQuickCollectPreset,
  isInvoiceCollectible,
  parseQuickCollectSearch,
  toQuickCollectAmountString,
} from './quick-collect';

describe('isInvoiceCollectible', () => {
  it('treats an unpaid taxed invoice as collectible (gross remaining)', () => {
    expect(isInvoiceCollectible({ amount: 100, tax_amount: 15, paid_amount: 0 })).toBe(true);
  });

  it('treats a partially paid invoice as collectible', () => {
    expect(isInvoiceCollectible({ amount: 100, tax_amount: 0, paid_amount: 60 })).toBe(true);
  });

  it('treats a fully paid invoice as not collectible', () => {
    expect(isInvoiceCollectible({ amount: 100, tax_amount: 15, paid_amount: 115 })).toBe(false);
  });

  it('treats an overpaid invoice as not collectible (clamped remaining)', () => {
    expect(isInvoiceCollectible({ amount: 100, tax_amount: 0, paid_amount: 150 })).toBe(false);
  });

  it('handles missing tax_amount as zero', () => {
    expect(isInvoiceCollectible({ amount: 80, paid_amount: 79.999 })).toBe(true);
    expect(isInvoiceCollectible({ amount: 80, paid_amount: 80 })).toBe(false);
  });
});

describe('toQuickCollectAmountString', () => {
  it('rounds to 3 decimal places for display precision', () => {
    expect(toQuickCollectAmountString(64.875)).toBe('64.875');
    expect(toQuickCollectAmountString(115)).toBe('115');
  });

  it('clamps invalid and negative values to zero', () => {
    expect(toQuickCollectAmountString(-10)).toBe('0');
    expect(toQuickCollectAmountString(Number.NaN)).toBe('0');
  });
});

describe('getQuickCollectPreset', () => {
  it('prefills the full gross remaining amount', () => {
    expect(getQuickCollectPreset({ id: 'inv-1', amount: 100, tax_amount: 15, paid_amount: 50 }))
      .toEqual({ invoiceId: 'inv-1', amount: '65' });
  });

  it('returns null when nothing remains to collect', () => {
    expect(getQuickCollectPreset({ id: 'inv-2', amount: 100, tax_amount: 15, paid_amount: 115 })).toBeNull();
  });
});

describe('findNextCollectibleInvoiceId', () => {
  const invoices = [
    { id: 'inv-paid', amount: 100, tax_amount: 0, paid_amount: 100 },
    { id: 'inv-current', amount: 100, tax_amount: 15, paid_amount: 115 },
    { id: 'inv-next', amount: 200, tax_amount: 0, paid_amount: 0 },
    { id: 'inv-last', amount: 300, tax_amount: 15, paid_amount: 100 },
  ];

  it('returns the first collectible invoice after the excluded one, in list order', () => {
    expect(findNextCollectibleInvoiceId(invoices, 'inv-current')).toBe('inv-next');
  });

  it('skips fully paid rows even when they come first', () => {
    expect(findNextCollectibleInvoiceId(invoices)).toBe('inv-next');
  });

  it('returns null when no collectible invoice exists', () => {
    expect(findNextCollectibleInvoiceId([
      { id: 'inv-a', amount: 100, tax_amount: 0, paid_amount: 100 },
    ])).toBeNull();
  });
});

describe('createInvoiceCollectHref', () => {
  it('builds the deep link with the invoice id and collect flag, url-encoded', () => {
    expect(createInvoiceCollectHref('inv-123')).toBe('/invoices?invoiceId=inv-123&collect=1');
    expect(createInvoiceCollectHref('inv id/42')).toBe('/invoices?invoiceId=inv%20id%2F42&collect=1');
  });
});

describe('parseQuickCollectSearch', () => {
  it('reads the invoice id and collect flag from loose search params', () => {
    expect(parseQuickCollectSearch({ invoiceId: 'inv-1', collect: '1' })).toEqual({ invoiceId: 'inv-1', collectRequested: true });
    expect(parseQuickCollectSearch({ invoiceId: 'inv-1' })).toEqual({ invoiceId: 'inv-1', collectRequested: false });
  });

  it('ignores missing or non-string invoice ids', () => {
    expect(parseQuickCollectSearch({})).toEqual({ invoiceId: '', collectRequested: false });
    expect(parseQuickCollectSearch({ invoiceId: 42 })).toEqual({ invoiceId: '', collectRequested: false });
  });

  it('does not arm collection for unrelated collect values', () => {
    expect(parseQuickCollectSearch({ invoiceId: 'inv-1', collect: '0' }).collectRequested).toBe(false);
    expect(parseQuickCollectSearch({ invoiceId: 'inv-1', collect: 'yes' }).collectRequested).toBe(false);
  });
});
