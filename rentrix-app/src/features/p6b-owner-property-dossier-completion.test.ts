import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6b — owner and property operational dossiers (closeout)', () => {
  it('shares one owner dossier body between the preview dialog and the full page', () => {
    const body = read('./owners/components/owner-dossier-body.tsx');
    const preview = read('./owners/components/OwnerPreviewDialog.tsx');
    const detail = read('./owners/components/owner-detail-view.tsx');
    expect(body).toContain('export function OwnerDossierBody');
    expect(preview).toContain('OwnerDossierBody');
    expect(detail).toContain('OwnerDossierBody');
  });

  it('surfaces the full real owner context: identity, KPIs, properties, units, contracts, financial, settlements, activity, documents', () => {
    const body = read('./owners/components/owner-dossier-body.tsx');
    expect(body).toContain('بيانات التواصل');
    // Tenant receivables are never presented as an owner balance.
    expect(body).toContain('مستحقات المستأجرين');
    expect(body).toContain('فواتير المستأجرين على العقارات');
    expect(body).toContain('العقارات المرتبطة');
    expect(body).toContain('الوحدات المرتبطة');
    expect(body).toContain('العقود المرتبطة');
    expect(body).toContain('تسويات المالك');
    expect(body).toContain('آخر النشاط');
    expect(body).toContain('ContextualDocumentsSection');
  });

  it('uses readable references, never raw ids, in the owner dossier', () => {
    const body = read('./owners/components/owner-dossier-body.tsx');
    expect(body).toContain('businessReferenceOrLabel');
    expect(body).toContain('unit.unit_number');
    expect(body).toContain('property.title');
    // Owner snapshot service must fetch business references for contracts/invoices.
    const service = read('./owners/services/owner-service.ts');
    expect(service).toMatch(/OwnerContract = Pick<Contract, [^>]*'reference'/);
    expect(service).toMatch(/OwnerInvoice = Pick<Invoice, [^>]*'reference'/);
  });

  it('reuses the real audit log as owner activity source with strict entity scoping', () => {
    const service = read('../services/owner-workspace-service.ts');
    expect(service).toContain('fetchAuditLog');
    // Strict scoping: the entity id is the hard requirement — never an OR that
    // admits every record of the entity type.
    expect(service).toContain("record.entityId === ownerId");
    expect(service).toContain("'owners' || record.entityType === 'owner'");
    expect(service).not.toContain("record.entityId === ownerId || record.entityType === 'owners'");
    const propertyService = read('../services/property-workspace-service.ts');
    expect(propertyService).toContain("record.entityId === propertyId");
    expect(propertyService).not.toContain("record.entityId === propertyId || record.entityType === 'properties'");
  });

  it('shares one property dossier content between the preview dialog and the full overview', () => {
    const content = read('./properties/components/property-dossier-content.tsx');
    const preview = read('./properties/components/PropertyPreviewDialog.tsx');
    const overview = read('./properties/overview/property-overview-page.tsx');
    expect(content).toContain('export function PropertyDossierContent');
    expect(preview).toContain('PropertyDossierContent');
    expect(overview).toContain('PropertyDossierContent');
  });

  it('surfaces the full real property context: identity, owners, units, contracts, financial, documents', () => {
    const content = read('./properties/components/property-dossier-content.tsx');
    expect(content).toContain('PropertyIdentityCard');
    expect(content).toContain('الملاك');
    expect(content).toContain('PropertyUnitsSummaryCard');
    expect(content).toContain('العقود والمستأجرون');
    expect(content).toContain('فواتير المستأجرين على العقار');
    // Company-aware formatting: no default/local money helpers in the dossier.
    expect(content).toContain('useCompanySettingsContract');
    expect(content).toContain('formatCompanyMoney');
    expect(content).toContain('ContextualDocumentsSection');
    // No fabricated stub financial summary remains.
    expect(content).not.toContain('سيظهر الملخص المالي هنا');
    expect(content).not.toContain('formatDefaultCompanyMoney');
  });

  it('keeps property financial context property-scoped in the shared service', () => {
    const service = read('../services/property-workspace-service.ts');
    expect(service).toContain('listInvoicesForProperty');
    expect(service).not.toContain("listInvoices({ search: '', status: 'all' })");
    expect(service).toContain('listContractsForProperty');
    expect(service).not.toContain('pageSize: 50');
  });

  it('gates owner edit affordances with the canonical owners write gate (owners.hub.view)', () => {
    const detailView = read('./owners/components/owner-detail-view.tsx');
    const preview = read('./owners/components/OwnerPreviewDialog.tsx');
    for (const source of [detailView, preview]) {
      expect(source).toContain("canAccess(authorization, 'owners.hub.view')");
      expect(source).toContain('canEditOwner');
    }
    const routeTree = read('../app/router/route-tree.ts');
    expect(routeTree).toContain("path: '/owners/$ownerId/edit'");
    expect(routeTree).toContain("requirePermission('owners.hub.view')");
  });

  it('keeps the owner edit route context-aware (register / dossier / direct fallback)', () => {
    const editRoute = read('../routes/_protected.owners.$ownerId.edit.tsx');
    expect(editRoute).toContain('useBackgroundLocation');
    expect(editRoute).toContain("backgroundPath.startsWith('/owners/')");
    expect(editRoute).toContain('backgroundIsOwnerDossier ? <OwnerDetailPage /> : <OwnersWorkspace />');
    expect(editRoute).toContain('window.history.back()');
    expect(editRoute).toContain("void navigate({ to: '/owners/$ownerId', params: { ownerId } });");
  });

  it('keeps the full property activity tab reachable with strict entity scoping', () => {
    const detailPage = read('./properties/property-detail-page.tsx');
    const tabs = read('./properties/components/property-workspace-tabs.tsx');
    expect(detailPage).toContain('PropertyActivityTab');
    expect(tabs).toContain('export function PropertyActivityTab');
    const service = read('../services/property-workspace-service.ts');
    expect(service).toContain("record.entityId === propertyId");
    expect(service).not.toContain("record.entityId === propertyId ||");
  });
});
