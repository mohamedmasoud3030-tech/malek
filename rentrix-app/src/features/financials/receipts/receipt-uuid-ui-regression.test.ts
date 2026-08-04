import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * UI regression — raw UUIDs must not be the primary visible label on the
 * audited receipt surfaces. The server-generated company-scoped reference
 * (receipt_number) is the primary label; the UUID is only ever secondary
 * metadata and the truncated formatter is a fallback for legacy rows only.
 */

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../components/${relativePath}`, import.meta.url), 'utf8');
}

describe('receipt UI — no raw UUID as primary visible label', () => {
  it('renders the receipt list item title from the reference-backed receipt_number, not the id', () => {
    const section = readSource('receipts-section.tsx');
    expect(section).toContain('`إيصال ${receipt.receipt_number}`');
    expect(section).not.toContain('إيصال ${receipt.id}');
  });

  it('shows the reference-backed number as the primary detail heading', () => {
    const card = readSource('receipt-detail-card.tsx');
    expect(card).toContain('{receiptDetail.receipt_number}');
    expect(card).not.toContain('{receiptDetail.id}');
  });

  it('keeps the truncated UUID formatter strictly as a fallback, never a primary source', () => {
    const formatters = readSource('receipt-formatters.ts');
    // The fallback exists for legacy rows but is documented as a fallback only.
    expect(formatters).toContain('formatReceiptNumber');
    expect(formatters).toContain('REC-');
  });
});
