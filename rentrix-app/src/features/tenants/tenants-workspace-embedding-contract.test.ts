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

  it('delegates embedded-vs-standalone shell ownership to EmbeddableWorkspace', () => {
    expect(source).toContain("import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';");
    expect(source).toContain('<EmbeddableWorkspace');
    expect(source).toContain('embedded={embedded}');
    expect(source).toContain('workspaceName="tenants"');
    expect(source).not.toContain('<PageLayout');
    expect(source).not.toContain('<PageHeader');
  });

  it('keeps create and modal actions available in both modes', () => {
    expect(source).toContain('primaryAction={createAction}');
    expect(source).toContain('<PersonFormModal open={formOpen}');
    expect(source).toContain('openCreate');
  });
});
