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
      '../../../../supabase/migrations/20260730091000_property_owner_workflow_invariants.sql',
    ).toLowerCase();

    expect(migration).toContain('o.company_id = v_company_id');
    expect(migration).toContain('and o.deleted_at is null');
    expect(migration).toContain('and o.is_active');
    expect(migration).toContain('p_owner_name input');
    expect(migration).toContain("set search_path to 'public', 'pg_temp'");
  });
});
