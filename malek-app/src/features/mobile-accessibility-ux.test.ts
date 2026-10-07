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

  it('2. Multi-step guided property wizard announces steps as steps, not as an incomplete tab widget', () => {
    // This header once claimed role="tablist"/role="tab" while owning no
    // role="tabpanel", no aria-controls and no arrow-key navigation. Assistive
    // technology therefore announced a tab widget whose keyboard contract did
    // not exist, and reported no selection state to a customer mid-form.
    // Validated wizard steps are steps: the header is a labelled nav whose
    // current entry carries aria-current="step".
    expect(propertyModalSource).toContain('<nav');
    expect(propertyModalSource).toContain('aria-label="خطوات إنشاء العقار"');
    for (const step of [1, 2, 3]) {
      expect(propertyModalSource).toContain(`aria-current={step === ${step} ? 'step' : undefined}`);
    }
    expect(propertyModalSource).not.toContain('role="tablist"');
    expect(propertyModalSource).not.toContain('role="tab"');
    expect(propertyModalSource).not.toContain('aria-selected=');
  });
});
