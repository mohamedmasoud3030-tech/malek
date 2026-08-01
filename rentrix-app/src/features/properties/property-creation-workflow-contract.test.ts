import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('canonical property creation workflow', () => {
  it('routes direct property creation through the owner-and-agreement form', () => {
    const routeSource = readSource('./property-form-page.tsx');

    expect(routeSource).toContain('propertyId ? <PropertyEditFormPage');
    expect(routeSource).toContain('<PropertyFormModal');
    expect(routeSource).not.toContain('useCreateProperty');
  });

  it('does not expose a raw properties insert service', () => {
    const serviceSource = readSource('./property-service.ts');
    const hooksSource = readSource('./use-properties.ts');

    expect(serviceSource).not.toMatch(/from\(['"]properties['"]\)\.insert/);
    expect(serviceSource).not.toContain('function createProperty(');
    expect(hooksSource).not.toContain('useCreateProperty');
  });

  it('keeps compatibility owner fields read-only in property forms', () => {
    const routeSource = readSource('./property-form-page.tsx');
    const schemaSource = readSource('./property-schema.ts');

    expect(routeSource).not.toContain("register('owner_name')");
    expect(schemaSource).not.toMatch(/\n\s*owner_name:/);
  });

  it('binds the atomic database RPC to an active owner in the caller company', () => {
    const migration = readSource(
      '../../../../supabase/migrations/20260730091300_property_owner_workflow_invariants.sql',
    ).toLowerCase();

    expect(migration).toContain('o.company_id = v_company_id');
    expect(migration).toContain('and o.deleted_at is null');
    expect(migration).toContain('and o.is_active');
    expect(migration).toContain('p_owner_name input');
    expect(migration).toContain("set search_path to 'public', 'pg_temp'");
  });

  it('implements a guided 3-step property creation workflow (Step 1 details, Step 2 ownership & agreement, Step 3 units & review)', () => {
    const modalSource = readSource('./property-form-modal.tsx');

    expect(modalSource).toContain('const [step, setStep] = useState<1 | 2 | 3>(1)');
    expect(modalSource).toContain('الخطوة 1: بيانات العقار');
    expect(modalSource).toContain('الخطوة 2: المالك، نوع الاتفاقية، قيمة العمولة');
    expect(modalSource).toContain('الخطوة 3: المراجعة والانتقال للوحدات');
    expect(modalSource).toContain('إضافة وحدات العقار:');
  });

  it('provides the full 360-degree property workspace with 8 addressable tabs', () => {
    const detailSource = readSource('./property-detail-page.tsx');

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
