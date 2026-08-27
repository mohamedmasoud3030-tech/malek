import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync(new URL('../components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const controller = readFileSync(new URL('./useInvoiceWorkspaceController.ts', import.meta.url), 'utf8');
const receiptsPage = readFileSync(new URL('../receipts/receipts-page.tsx', import.meta.url), 'utf8');
const readiness = readFileSync(new URL('../billing/billing-readiness-section.tsx', import.meta.url), 'utf8');

describe('focused Money collection workspaces', () => {
  it('keeps the invoice workspace focused on readiness, invoices and selected-invoice collection', () => {
    expect(workspace).toContain('<BillingReadinessSection />');
    expect(workspace).toContain('<InvoiceListSection');
    expect(workspace).toContain('<InvoiceDetailSection');
    expect(workspace).not.toContain('ReceiptsSection');
  });

  it('does not fetch a second receipt register from the invoice controller', () => {
    expect(controller).toContain("useReceipt(collectionSuccess?.receiptId ?? '')");
    expect(controller).not.toContain('useReceipts({ limit: 10 })');
    expect(controller).not.toContain('selectedReceiptId');
    expect(controller).not.toContain('setSelectedReceiptId');
  });

  it('preserves the dedicated receipts workspace as the receipt register owner', () => {
    expect(receiptsPage).toContain('ReceiptsHistoryContent');
    expect(receiptsPage).toContain('useReceipts({ limit: receiptsLimit })');
    expect(receiptsPage).toContain('جدول الإيصالات');
  });

  it('keeps readiness details collapsed by default before the invoice register', () => {
    expect(readiness).toContain('useState(false)');
    expect(readiness).toContain('data-billing-details');
    expect(readiness).toContain('عرض التفاصيل');
  });
});
