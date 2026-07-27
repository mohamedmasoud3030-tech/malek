import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('relationships hub visible UX contract', () => {
  const hubSource = readFileSync(resolve(import.meta.dirname, 'relationships-hub-page.tsx'), 'utf8');
  const routeSource = readFileSync(
    resolve(import.meta.dirname, '../../routes/_protected.communication.tsx'),
    'utf8',
  );

  it('turns the communication destination into a visible relationships hub', () => {
    expect(routeSource).toContain('RelationshipsHubPage as CommunicationRouteComponent');
    expect(hubSource).toContain('title="مركز العلاقات"');
    expect(hubSource).toContain('ariaLabel="أقسام مركز العلاقات"');
  });

  it('shows communication and tenants as real tabs with embedded workspaces', () => {
    expect(hubSource).toContain("label: 'التواصل والمتابعات'");
    expect(hubSource).toContain("label: 'المستأجرون'");
    expect(hubSource).toContain('<CommunicationWorkspace embedded />');
    expect(hubSource).toContain('<TenantsWorkspace embedded />');
  });

  it('stays isolated from the financial workspace owned by the parallel agent', () => {
    expect(hubSource).not.toContain('@/features/financials');
    expect(hubSource).not.toContain('financials-page');
    expect(hubSource).not.toContain('route-tree');
    expect(hubSource).not.toContain('app-nav-items');
  });
});
