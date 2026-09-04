import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * UI regression — raw UUIDs must not be the primary visible label on the
 * audited receipt surfaces. The server-generated company-scoped reference
 * (receipt_number) is the primary label; internal IDs are routing keys only
 * and never become fabricated document references.
 */

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('receipt UI — no raw UUID as primary visible label', () => {
  it('renders the receipt list identity from the reference-backed receipt_number, not the id', () => {
    const page = readSource('./receipts-page.tsx');
    expect(page).toContain("key: 'receipt_number', label: 'رقم الإيصال', locked: true");
    expect(page).not.toContain('إيصال ${receipt.id}');
  });

  it('shows the reference-backed number as the primary detail heading', () => {
    const card = readSource('../components/receipt-detail-card.tsx');
    expect(card).toContain('{receiptDetail.receipt_number}');
    expect(card).not.toContain('{receiptDetail.id}');
  });

  it('never fabricates a receipt reference from an internal payment id', () => {
    const formatters = readSource('../components/receipt-formatters.ts');
    expect(formatters).toContain('formatReceiptNumber');
    expect(formatters).toContain('إيصال بلا مرجع تجاري');
    expect(formatters).not.toContain('paymentId.slice');
  });
});
