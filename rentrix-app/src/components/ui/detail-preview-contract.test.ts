import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractTable = readFileSync(new URL('../../features/contracts/components/ContractTable.tsx', import.meta.url), 'utf8');
const invoiceWorkspace = readFileSync(new URL('../../features/financials/components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const receiptsPage = readFileSync(new URL('../../features/financials/receipts/receipts-page.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const maintenanceWorkspace = readFileSync(new URL('../../features/maintenance/components/maintenance-workspace.tsx', import.meta.url), 'utf8');
const maintenanceOverlay = readFileSync(new URL('../../features/maintenance/components/maintenance-detail-resolve-overlays.tsx', import.meta.url), 'utf8');
const previewDialog = readFileSync(new URL('./entity-preview-dialog.tsx', import.meta.url), 'utf8');
const routeTree = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
const contractDetailRoute = readFileSync(new URL('../../features/contracts/pages/ContractDetailPage.tsx', import.meta.url), 'utf8');
const ownerDetailRoute = readFileSync(new URL('../../features/owners/owner-detail-page.tsx', import.meta.url), 'utf8');
const propertyDetailRoute = readFileSync(new URL('../../features/properties/overview/property-overview-page.tsx', import.meta.url), 'utf8');
const unitDetailRoute = readFileSync(new URL('../../features/properties/units/property-unit-detail-page.tsx', import.meta.url), 'utf8');
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
    expect(contractTable).not.toContain('mobileVisibleSecondaryKey="tenant"');
    expect(contractTable).toContain("priority: \"identity\"");
    expect(contractTable).toContain("priority: \"primary\"");
    expect(contractTable).toContain("priority: \"actions\"");
    expect(contractTable).not.toContain('to="/contracts/$contractId"');
    expect(contractTable).not.toContain('ContractMobileCard');
    // Residual page-local mobile card module must stay deleted.
    expect(existsSync(new URL('../../features/contracts/components/ContractMobileCard.tsx', import.meta.url))).toBe(false);
  });

  it('renders invoice details inside the shared preview surface and receipt details via the shared detail card', () => {
    expect(invoiceWorkspace).toContain('<EntityPreviewDialog');
    expect(invoiceWorkspace).toContain('<InvoiceDetailSection');
    expect(receiptsPage).toContain('<ReceiptDetailCard');
  });

  it('routes property and unit register browsing via route-native navigation (Phase 3)', () => {
    expect(propertyController).toContain("to: '/properties/$propertyId'");
    expect(propertyController).not.toContain("openEntityPreview");
    expect(unitController).toContain("to: '/properties/$propertyId/units/$unitId'");
    expect(unitController).not.toContain("openEntityPreview");
  });

  it('keeps owner and maintenance details on the same shared EntityPreviewDialog primitive', () => {
    // Owner rows open the owner preview dialog, which renders the shared
    // EntityPreviewDialog surface (see OwnerPreviewDialog.tsx).
    expect(ownerWorkspace).toContain('<OwnerPreviewDialog');
    const ownerPreview = readFileSync(new URL('../../features/owners/components/OwnerPreviewDialog.tsx', import.meta.url), 'utf8');
    expect(ownerPreview).toContain('<EntityPreviewDialog');
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

  it('dedicated heavyweight entity routes render canonical full pages bound directly from route-tree', () => {
    expect(routeTree).toContain("import('@/features/contracts/pages/ContractDetailPage')");
    expect(routeTree).toContain("import('@/features/owners/owner-detail-page')");
    expect(routeTree).toContain("import('@/features/properties/property-detail-page')");
    expect(routeTree).toContain("import('@/features/properties/overview/property-overview-page')");
    expect(routeTree).toContain("import('@/features/properties/units/property-unit-detail-page')");
    expect(contractDetailRoute).toContain('ContractDetailPage');
    expect(ownerDetailRoute).toContain('OwnerDetailPage');
    expect(propertyDetailRoute).toContain('PropertyOverview');
    expect(unitDetailRoute).toContain('PropertyUnitDetailPage');
    for (const src of [contractDetailRoute, ownerDetailRoute, propertyDetailRoute, unitDetailRoute]) {
      expect(src).not.toContain('useBackgroundLocation');
      expect(src).not.toContain('window.history.back()');
      expect(src).not.toContain('openEntityPreview');
    }
  });
});
