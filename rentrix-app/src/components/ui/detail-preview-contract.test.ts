import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractTable = readFileSync(new URL('../../features/contracts/components/ContractTable.tsx', import.meta.url), 'utf8');
const contractResults = readFileSync(new URL('../../features/contracts/components/ContractResults.tsx', import.meta.url), 'utf8');
const invoiceWorkspace = readFileSync(new URL('../../features/financials/components/invoice-workspace-section.tsx', import.meta.url), 'utf8');
const receiptsPage = readFileSync(new URL('../../features/financials/receipts/receipts-page.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const maintenanceWorkspace = readFileSync(new URL('../../features/maintenance/components/maintenance-workspace.tsx', import.meta.url), 'utf8');
const maintenanceOverlay = readFileSync(new URL('../../features/maintenance/components/maintenance-detail-resolve-overlays.tsx', import.meta.url), 'utf8');
const previewDialog = readFileSync(new URL('./entity-preview-dialog.tsx', import.meta.url), 'utf8');
const quickPreview = readFileSync(new URL('./quick-preview.tsx', import.meta.url), 'utf8');
const routeTree = readFileSync(new URL('../../app/router/route-tree.ts', import.meta.url), 'utf8');
const contractDetailRoute = readFileSync(new URL('../../features/contracts/pages/ContractDetailPage.tsx', import.meta.url), 'utf8');
const ownerDetailRoute = readFileSync(new URL('../../features/owners/owner-detail-page.tsx', import.meta.url), 'utf8');
const propertyDetailRoute = readFileSync(new URL('../../features/properties/overview/property-overview-page.tsx', import.meta.url), 'utf8');
const unitDetailRoute = readFileSync(new URL('../../features/properties/units/property-unit-detail-page.tsx', import.meta.url), 'utf8');
const legacyRedirect = readFileSync(new URL('../../app/router/legacy-preview-redirect.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

describe('unified detail preview contract', () => {
  it('uses one compact centered preview shell — never a page-sized surface', () => {
    expect(previewDialog).toContain('EntityPreviewDialog');
    // Compact modal widths (22rem phone / 30rem tablet / 36rem desktop max),
    // with the register visible behind the backdrop.
    expect(previewDialog).toContain('max-w-[22rem]');
    expect(previewDialog).toContain('sm:w-[min(92vw,30rem)]');
    expect(previewDialog).toContain('md:max-w-[36rem]');
    expect(previewDialog).not.toContain('max-w-5xl');
    expect(previewDialog).not.toContain('90dvh');
    expect(previewDialog).not.toContain('max-h-full');
    expect(previewDialog).toContain('إغلاق المعاينة');
    expect(previewDialog).toContain('bg-[hsl(var(--sidebar))]');
  });

  it('provides the shared glance-first fact grid for preview bodies', () => {
    expect(quickPreview).toContain('PreviewFacts');
    expect(quickPreview).toContain('sm:grid-cols-2');
  });

  it('keeps contract row click and mobile actions on the shared EntityTable register with an explicit full-page action', () => {
    expect(contractTable).toContain('onRowClick={(contract) => onPreview(contract.id)}');
    expect(contractTable).toContain('EntityTable');
    expect(contractTable).toContain('onOpenFull');
    expect(contractTable).toContain('فتح العقد بالكامل');
    expect(contractTable).toContain('معاينة سريعة');
    expect(contractTable).toContain("priority: \"identity\"");
    expect(contractTable).toContain("priority: \"primary\"");
    expect(contractTable).toContain("priority: \"actions\"");
    expect(contractTable).not.toContain('to="/contracts/$contractId"');
    expect(contractTable).not.toContain('ContractMobileCard');
    expect(contractResults).not.toContain('expandedId');
    expect(contractResults).not.toContain('setExpandedId');
    // Residual page-local mobile card module must stay deleted.
    expect(existsSync(new URL('../../features/contracts/components/ContractMobileCard.tsx', import.meta.url))).toBe(false);
  });

  it('renders invoice details in the shared preview and receipt inspection via ReceiptPreviewDialog, not an inline card', () => {
    expect(invoiceWorkspace).toContain('<EntityPreviewDialog');
    expect(invoiceWorkspace).toContain('<InvoiceDetailSection');
    expect(invoiceWorkspace).toContain('<InvoicePreviewDialog');
    expect(receiptsPage).toContain('<ReceiptPreviewDialog');
    expect(receiptsPage).not.toContain('<ReceiptDetailCard');
    expect(existsSync(new URL('../../features/financials/components/receipt-detail-card.tsx', import.meta.url))).toBe(false);
  });

  it('keeps the printable receipt surface as the only standalone receipt deep-link', () => {
    expect(receiptsPage).toContain('return <ReceiptDetailPage />;');
    expect(receiptsPage).toContain('receiptId');
  });

  it('routes full property/unit workspaces via explicit actions only, not row navigation', () => {
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
    // The full page is reached only through the explicit «فتح الملف الكامل» action.
    expect(ownerWorkspace).toContain("navigate({ to: '/owners/$ownerId'");
    expect(ownerWorkspace).toContain('فتح الملف الكامل');
    expect(ownerWorkspace).toContain('معاينة سريعة');
    expect(maintenanceWorkspace).toContain('<MaintenanceDetailsOverlay');
    expect(maintenanceOverlay).toContain('<EntityPreviewDialog');
    expect(maintenanceOverlay).not.toContain('title="تفاصيل طلب الصيانة"');
  });

  it('Phase 3.1: global event bus deleted, replaced by route-native background location', () => {
    expect(existsSync(new URL('./entity-preview-events.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./entity-preview-host.tsx', import.meta.url))).toBe(false);
    expect(legacyRedirect).toContain('previewKind');
    expect(legacyRedirect).toContain('previewId');
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
