import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractTable = readFileSync(new URL('../../features/contracts/components/ContractTable.tsx', import.meta.url), 'utf8');
const contractMobile = readFileSync(new URL('../../features/contracts/components/ContractMobileCard.tsx', import.meta.url), 'utf8');
const invoiceWorkspace = readFileSync(new URL('../../features/financials/components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const previewDialog = readFileSync(new URL('./entity-preview-dialog.tsx', import.meta.url), 'utf8');

describe('in-place detail preview contract', () => {
  it('uses one shared large preview surface for record details', () => {
    expect(previewDialog).toContain('EntityPreviewDialog');
    expect(previewDialog).toContain('max-w-5xl');
    expect(previewDialog).toContain('overflow-y-auto');
  });

  it('keeps contract view actions inside the register instead of navigating to a detail page', () => {
    expect(contractTable).toContain('onPreview(contract.id)');
    expect(contractTable).not.toContain('to="/contracts/$contractId"');
    expect(contractMobile).toContain('onPreview(contract.id)');
    expect(contractMobile).not.toContain("navigate({ to: '/contracts/$contractId'");
  });

  it('renders invoice detail inside the shared preview surface', () => {
    expect(invoiceWorkspace).toContain('<EntityPreviewDialog');
    expect(invoiceWorkspace).toContain('<InvoiceDetailSection');
    expect(invoiceWorkspace).toContain("ctrl.setSelectedInvoiceId('')");
  });
});
