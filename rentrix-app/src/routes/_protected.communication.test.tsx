import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('communication route — IA simplification 2026-08', () => {
  const routeSource = readFileSync(
    resolve(import.meta.dirname, '_protected.communication.tsx'),
    'utf8',
  );

  it('renders a single Communication workspace without duplicating tenants', () => {
    expect(routeSource).toContain('export function CommunicationRouteComponent()');
    expect(routeSource).toContain('title="التواصل والمتابعات"');
    expect(routeSource).toContain('<CommunicationWorkspace embedded />');
    // Removed duplicate tenants tab that previously duplicated the Relationships hub
    expect(routeSource).not.toContain("label: 'المستأجرون'");
    expect(routeSource).not.toContain('<TenantsWorkspace embedded />');
    expect(routeSource).not.toContain('ariaLabel="أقسام مركز العلاقات"');
  });

  it('documents why tenants lives canonically in the Relationships hub', () => {
    expect(routeSource).toContain('canonical tenants surface remains at /contracts?section=tenants');
    expect(routeSource).toContain('IA simplification 2026-08');
  });

  it('stays isolated from the financial workspace owned by the parallel agent', () => {
    expect(routeSource).not.toContain('@/features/financials');
    expect(routeSource).not.toContain('financials-page');
    expect(routeSource).not.toContain('route-tree');
    expect(routeSource).not.toContain('app-nav-items');
  });
});
