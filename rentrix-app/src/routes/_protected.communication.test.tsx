import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('relationships hub visible UX contract', () => {
  const routeSource = readFileSync(
    resolve(import.meta.dirname, '_protected.communication.tsx'),
    'utf8',
  );

  it('turns the communication destination into a visible relationships hub', () => {
    expect(routeSource).toContain('export function CommunicationRouteComponent()');
    expect(routeSource).toContain('title="مركز العلاقات"');
    expect(routeSource).toContain('ariaLabel="أقسام مركز العلاقات"');
  });

  it('shows communication and tenants as real tabs with embedded workspaces', () => {
    expect(routeSource).toContain("label: 'التواصل والمتابعات'");
    expect(routeSource).toContain("label: 'المستأجرون'");
    expect(routeSource).toContain('<CommunicationWorkspace embedded />');
    expect(routeSource).toContain('<TenantsWorkspace embedded />');
  });

  it('stays isolated from the financial workspace owned by the parallel agent', () => {
    expect(routeSource).not.toContain('@/features/financials');
    expect(routeSource).not.toContain('financials-page');
    expect(routeSource).not.toContain('route-tree');
    expect(routeSource).not.toContain('app-nav-items');
  });
});
