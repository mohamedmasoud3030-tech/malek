import { describe, expect, it } from 'vitest';
import { readSource } from '../../test/read-source';

describe('canonical property creation workflow', () => {
  it('routes direct property creation through the owner-and-agreement form', () => {
    const routeSource = readSource(import.meta.url, './property-form-page.tsx');

    expect(routeSource).toContain('propertyId ? <PropertyEditFormPage');
    expect(routeSource).toContain('<PropertyFormModal');
    expect(routeSource).not.toContain('useCreateProperty');
  });

  it('does not expose a raw properties insert service', () => {
    const serviceSource = readSource(import.meta.url, './property-service.ts');
    const hooksSource = readSource(import.meta.url, './use-properties.ts');

    expect(serviceSource).not.toMatch(/from\(['"]properties['"]\)\.insert/);
    expect(serviceSource).not.toContain('function createProperty(');
    expect(hooksSource).not.toContain('useCreateProperty');
  });

  it('keeps compatibility owner fields read-only in property forms', () => {
    const routeSource = readSource(import.meta.url, './property-form-page.tsx');
    const schemaSource = readSource(import.meta.url, './property-schema.ts');

    expect(routeSource).not.toContain("register('owner_name')");
    expect(schemaSource).not.toMatch(/\n\s*owner_name:/);
  });

  it('implements a guided 3-step property creation workflow (Step 1 details, Step 2 ownership & agreement, Step 3 units & review)', () => {
    const modalSource = readSource(import.meta.url, './property-form-modal.tsx');

    expect(modalSource).toContain('const [step, setStep] = useState<1 | 2 | 3>(1)');
    expect(modalSource).toContain('الخطوة 1: بيانات العقار');
    expect(modalSource).toContain('الخطوة 2: المالك، نوع الاتفاقية، قيمة العمولة');
    expect(modalSource).toContain('الخطوة 3: المراجعة والانتقال للوحدات');
    expect(modalSource).toContain('إضافة وحدات العقار:');
  });

  it('provides the full 360-degree property workspace with 8 addressable tabs', () => {
    const detailSource = readSource(import.meta.url, './property-detail-page.tsx');

    expect(detailSource).toContain('نظرة عامة');
    expect(detailSource).toContain('الوحدات العقارية');
    expect(detailSource).toContain("tab: 'contracts'");
    expect(detailSource).toContain("tab: 'financials'");
    expect(detailSource).toContain("tab: 'maintenance'");
    expect(detailSource).toContain("tab: 'ownership'");
    expect(detailSource).toContain("tab: 'documents'");
    expect(detailSource).toContain("tab: 'activity'");
  });
});
