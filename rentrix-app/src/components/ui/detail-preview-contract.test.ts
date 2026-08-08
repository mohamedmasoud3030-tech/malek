import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractTable = readFileSync(new URL('../../features/contracts/components/ContractTable.tsx', import.meta.url), 'utf8');
const contractMobile = readFileSync(new URL('../../features/contracts/components/ContractMobileCard.tsx', import.meta.url), 'utf8');
const invoiceWorkspace = readFileSync(new URL('../../features/financials/components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const receiptsSection = readFileSync(new URL('../../features/financials/components/receipts-section.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const maintenanceWorkspace = readFileSync(new URL('../../features/maintenance/components/maintenance-workspace.tsx', import.meta.url), 'utf8');
const previewDialog = readFileSync(new URL('./entity-preview-dialog.tsx', import.meta.url), 'utf8');

describe('in-place detail preview contract', () => {
  it('uses one shared large MALEK Pro preview surface for record details', () => {
    expect(previewDialog).toContain('EntityPreviewDialog');
    expect(previewDialog).toContain('max-w-5xl');
    expect(previewDialog).toContain('overflow-y-auto');
    expect(previewDialog).toContain('bg-[hsl(var(--sidebar))]');
    expect(previewDialog).toContain('إغلاق المعاينة');
  });

  it('keeps contract view actions inside the register instead of navigating to a detail page', () => {
    expect(contractTable).toContain('onPreview(contract.id)');
    expect(contractTable).not.toContain('to="/contracts/$contractId"');
    expect(contractMobile).toContain('onPreview(contract.id)');
    expect(contractMobile).not.toContain("navigate({ to: '/contracts/$contractId'");
  });

  it('renders invoice and receipt details inside the shared preview surface', () => {
    expect(invoiceWorkspace).toContain('<EntityPreviewDialog');
    expect(invoiceWorkspace).toContain('<InvoiceDetailSection');
    expect(invoiceWorkspace).toContain("ctrl.setSelectedInvoiceId('')");
    expect(receiptsSection).toContain('<EntityPreviewDialog');
    expect(receiptsSection).toContain('<ReceiptDetailCard');
    expect(receiptsSection).toContain("onSelectReceipt('')");
  });

  it('routes property and unit register browsing into the global preview host', () => {
    expect(propertyController).toContain("openEntityPreview({ kind: 'property', id: propertyId })");
    expect(unitController).toContain("openEntityPreview({ kind: 'unit', id: unit.id })");
  });

  it('opens owner details in place and preserves maintenance existing overlay behavior', () => {
    expect(ownerWorkspace).toContain('<EntityPreviewDialog');
    expect(ownerWorkspace).not.toContain("navigate({ to: '/owners/$ownerId'");
    expect(maintenanceWorkspace).toContain('<MaintenanceDetailsOverlay');
    expect(maintenanceWorkspace).toContain('onViewDetails={controller.setDetailsRequest}');
  });
});
