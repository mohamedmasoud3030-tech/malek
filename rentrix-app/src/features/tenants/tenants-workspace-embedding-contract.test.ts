import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('tenants embeddable workspace contract', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'TenantsPage.tsx'), 'utf8');

  it('exports a reusable workspace and preserves the route page', () => {
    expect(source).toContain('export function TenantsWorkspace');
    expect(source).toContain('export function TenantsPage()');
    expect(source).toContain('return <TenantsWorkspace />;');
  });

  it('keeps the embedded branch free of nested page shells', () => {
    const embeddedSection = source.match(
      /<section data-workspace="tenants"[\s\S]*?<\/section>/,
    )?.[0];

    expect(embeddedSection).toBeDefined();
    expect(embeddedSection).not.toContain('<PageLayout');
    expect(embeddedSection).not.toContain('<PageHeader');
  });

  it('keeps create and modal actions available in both modes', () => {
    expect(source).toContain('<div className="flex justify-end">{createAction}</div>');
    expect(source).toContain('<PersonFormModal open={formOpen}');
    expect(source).toContain('onCreate={openCreate}');
  });
});
