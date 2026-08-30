import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Mobile RTL and accessibility UX quality contract for operational surfaces.
 * The retired NextStepActions contract was removed with its component; this
 * file keeps the live property workspace contracts.
 */
describe('mobile RTL and accessibility UX quality contract', () => {
  const propertyModalSource = readFileSync(
    resolve(import.meta.dirname, './properties/property-form-modal.tsx'),
    'utf8',
  );

  const propertyDetailSource = readFileSync(
    resolve(import.meta.dirname, './properties/property-detail-page.tsx'),
    'utf8',
  );

  it('1. Arabic RTL rendering is explicitly enforced on wide property workspaces', () => {
    expect(propertyDetailSource).toContain('dir="rtl"');
    expect(propertyDetailSource).toContain('aria-label="أقسام العقار"');
  });

  it('2. Multi-step guided property wizard exposes accessible tablist and tab roles with visible state', () => {
    expect(propertyModalSource).toContain('role="tablist"');
    expect(propertyModalSource).toContain('role="tab"');
    expect(propertyModalSource).toContain('aria-selected={step === 1}');
    expect(propertyModalSource).toContain('aria-selected={step === 2}');
    expect(propertyModalSource).toContain('aria-selected={step === 3}');
  });
});
