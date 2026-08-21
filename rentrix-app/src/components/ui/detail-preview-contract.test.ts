import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractTable = readFileSync(new URL('../../features/contracts/components/ContractTable.tsx', import.meta.url), 'utf8');
const invoiceWorkspace = readFileSync(new URL('../../features/financials/components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const receiptsSection = readFileSync(new URL('../../features/financials/components/receipts-section.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const maintenanceWorkspace = readFileSync(new URL('../../features/maintenance/components/maintenance-workspace.tsx', import.meta.url), 'utf8');
const maintenanceOverlay = readFileSync(new URL('../../features/maintenance/components/maintenance-detail-resolve-overlays.tsx', import.meta.url), 'utf8');
const previewDialog = readFileSync(new URL('./entity-preview-dialog.tsx', import.meta.url), 'utf8');
const contractDetailRoute = readFileSync(new URL('../../routes/_protected.contracts.$contractId.tsx', import.meta.url), 'utf8');
const ownerDetailRoute = readFileSync(new URL('../../routes/_protected.owners.$ownerId.tsx', import.meta.url), 'utf8');
const propertyDetailRoute = readFileSync(new URL('../../routes/_protected.properties.$propertyId.index.tsx', import.meta.url), 'utf8');
const unitDetailRoute = readFileSync(new URL('../../routes/_protected.properties.$propertyId.units.$unitId.tsx', import.meta.url), 'utf8');
const backgroundLocation = readFileSync(new URL('../../app/router/background-location.tsx', import.meta.url), 'utf8');
const legacyRedirect = readFileSync(new URL('../../app/router/legacy-preview-redirect.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

describe('unified detail preview contract', () => {
  it('uses one shared large MALEK Pro preview surface for record details', () => {
    expect(previewDialog).toContain('EntityPreviewDialog');
    expect(previewDialog).toContain('max-w-5xl');
    expect(previewDialog).toContain('overflow-y-auto');
    expect(previewDialog).toContain('bg-[hsl(var(--sidebar))]');
    expect(previewDialog).toContain('إغلاق المعاينة');
  });

  it('keeps contract view actions inside the shared EntityTable register instead of a page-local mobile card', () => {
    expect(contractTable).toContain('onPreview(contract.id)');
    expect(contractTable).toContain('EntityTable');
    expect(contractTable).toContain('mobileVisibleSecondaryKeys={["tenant", "unit", "status"]}');
    expect(contractTable).toContain("priority: \"identity\"");
    expect(contractTable).toContain("priority: \"primary\"");
    expect(contractTable).toContain("priority: \"actions\"");
    expect(contractTable).not.toContain('to="/contracts/$contractId"');
    expect(contractTable).not.toContain('ContractMobileCard');
    // Residual page-local mobile card module must stay deleted.
    expect(existsSync(new URL('../../features/contracts/components/ContractMobileCard.tsx', import.meta.url))).toBe(false);
  });

  it('renders invoice and receipt details inside the shared preview surface', () => {
    expect(invoiceWorkspace).toContain('<EntityPreviewDialog');
    expect(invoiceWorkspace).toContain('<InvoiceDetailSection');
    expect(receiptsSection).toContain('<EntityPreviewDialog');
    expect(receiptsSection).toContain('<ReceiptDetailCard');
  });

  it('routes property and unit register browsing via route-native navigation (Phase 3)', () => {
    expect(propertyController).toContain("to: '/properties/$propertyId'");
    expect(propertyController).not.toContain("openEntityPreview");
    expect(unitController).toContain("to: '/properties/$propertyId/units/$unitId'");
    expect(unitController).not.toContain("openEntityPreview");
  });

  it('keeps owner and maintenance details on the same shared EntityPreviewDialog primitive', () => {
    expect(ownerWorkspace).toContain('<EntityPreviewDialog');
    expect(ownerWorkspace).not.toContain("navigate({ to: '/owners/$ownerId'");
    expect(maintenanceWorkspace).toContain('<MaintenanceDetailsOverlay');
    expect(maintenanceOverlay).toContain('<EntityPreviewDialog');
    expect(maintenanceOverlay).not.toContain('title="تفاصيل طلب الصيانة"');
  });

  it('Phase 3.1: global event bus deleted, replaced by route-native background location', () => {
    expect(existsSync(new URL('./entity-preview-events.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./entity-preview-host.tsx', import.meta.url))).toBe(false);
    expect(backgroundLocation).toContain('BackgroundLocationProvider');
    expect(backgroundLocation).toContain('useBackgroundLocation');
    expect(backgroundLocation).toContain('backgroundLocation');
    expect(legacyRedirect).toContain('previewKind');
    expect(legacyRedirect).toContain('previewId');
    expect(protectedRoute).toContain('BackgroundLocationProvider');
    expect(protectedRoute).toContain('LegacyPreviewRedirect');
    expect(protectedRoute).not.toContain('EntityPreviewHost');
  });

  it('dedicated entity detail routes are route-native (Phase 3: dialog over background vs full page)', () => {
    // Contract
    expect(contractDetailRoute).toContain('useBackgroundLocation');
    expect(contractDetailRoute).toContain('isDialog');
    expect(contractDetailRoute).toContain('ContractPreviewDialog');
    expect(contractDetailRoute).toContain('ContractDetailPage');
    expect(contractDetailRoute).not.toContain("openEntityPreview");
    // Owner
    expect(ownerDetailRoute).toContain('useBackgroundLocation');
    expect(ownerDetailRoute).toContain('OwnerPreviewDialog');
    expect(ownerDetailRoute).toContain('OwnerDetailPage');
    expect(ownerDetailRoute).not.toContain("openEntityPreview");
    // Property detail now handles dialog vs full page directly
    const propertyDetailFull = readFileSync(new URL('../../routes/_protected.properties.$propertyId.tsx', import.meta.url), 'utf8');
    expect(propertyDetailFull).toContain('useBackgroundLocation');
    expect(propertyDetailFull).toContain('PropertyPreviewDialog');
    expect(propertyDetailFull).toContain('PropertyDetailPage');
    // Property overview is now real content, not adapter
    expect(propertyDetailRoute).toContain('PropertyOverview');
    expect(propertyDetailRoute).not.toContain("openEntityPreview");
    expect(unitDetailRoute).toContain('useBackgroundLocation');
    expect(unitDetailRoute).toContain('PropertyUnitDetailPage');
    expect(unitDetailRoute).toContain('UnitPreviewDialog');
    expect(unitDetailRoute).not.toContain("openEntityPreview");
  });
});
