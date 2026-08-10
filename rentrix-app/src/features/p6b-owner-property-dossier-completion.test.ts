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
    expect(body).toContain('الرصيد المستحق');
    expect(body).toContain('العقارات المرتبطة');
    expect(body).toContain('الوحدات المرتبطة');
    expect(body).toContain('العقود المرتبطة');
    expect(body).toContain('السياق المالي');
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

  it('reuses the real audit log as owner activity source without a synthetic feed', () => {
    const service = read('../services/owner-workspace-service.ts');
    expect(service).toContain('fetchAuditLog');
    expect(service).toContain("entityId === ownerId || record.entityType === 'owners'");
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
    expect(content).toContain('السياق المالي');
    expect(content).toContain('ContextualDocumentsSection');
    // No fabricated stub financial summary remains.
    expect(content).not.toContain('سيظهر الملخص المالي هنا');
  });

  it('keeps property financial context property-scoped in the shared service', () => {
    const service = read('../services/property-workspace-service.ts');
    expect(service).toContain('propertyContractIds.has(invoice.contract_id)');
  });
});
