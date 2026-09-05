import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('P6b — owner and property operational dossiers (closeout)', () => {
  it('keeps the owner dossier body on the full page and the quick preview glance-first', () => {
    const body = read('./owners/components/owner-dossier-body.tsx');
    const preview = read('./owners/components/OwnerPreviewDialog.tsx');
    const detail = read('./owners/components/owner-detail-view.tsx');
    expect(body).toContain('export function OwnerDossierBody');
    expect(detail).toContain('OwnerDossierBody');
    // The Quick Preview is a glance-first inspection on the canonical shell —
    // the dossier body (tables, history, documents) is not miniaturized into it.
    expect(preview).toContain('<EntityPreviewDialog');
    expect(preview).toContain('PreviewFacts');
    expect(preview).not.toContain('OwnerDossierBody');
  });

  it('surfaces the operational owner context: identity, KPIs, properties, units, contracts, activity, documents', () => {
    const body = read('./owners/components/owner-dossier-body.tsx');
    expect(body).toContain('بيانات التواصل');
    expect(body).toContain('العقارات المرتبطة');
    expect(body).toContain('الوحدات المرتبطة');
    expect(body).toContain('العقود المرتبطة');
    expect(body).toContain('آخر النشاط');
    expect(body).toContain('ContextualDocumentsSection');
    // Tenant receivables and owner settlements are never presented as an
    // owner balance — account-statement detail is opened from the owner
    // context without embedding settlement data in the dossier.
    expect(body).not.toContain('تسويات المالك');
    const detailView = read('./owners/components/owner-detail-view.tsx');
    expect(detailView).toContain('افتح كشف الحساب من هنا لمراجعة الحركات والأرصدة المالية');
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

  it('uses the canonical property dossier content in the full overview', () => {
    const content = read('./properties/components/property-dossier-content.tsx');
    const overview = read('./properties/overview/property-overview-page.tsx');
    expect(content).toContain('export function PropertyDossierContent');
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
    // The full page owns the write gate.
    expect(detailView).toContain("canAccess(authorization, 'owners.hub.view')");
    expect(detailView).toContain('canEditOwner');
    // The preview is read-only inspection; its edit action is supplied by the
    // permissions-gated workspace parent.
    expect(preview).not.toContain('canAccess(');
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
