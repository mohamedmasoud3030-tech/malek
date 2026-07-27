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
    expect(source).toContain('data-workspace="tenants"');

    const embeddedBranch = source.slice(
      source.indexOf('const workspace = embedded ?'),
      source.indexOf(') : (\n    <PageLayout'),
    );

    expect(embeddedBranch).not.toContain('<PageLayout');
    expect(embeddedBranch).not.toContain('<PageHeader');
  });

  it('keeps create and modal actions available in both modes', () => {
    expect(source).toContain('<div className="flex justify-end">{createAction}</div>');
    expect(source).toContain('<PersonFormModal open={formOpen}');
    expect(source).toContain('onCreate={openCreate}');
  });
});
