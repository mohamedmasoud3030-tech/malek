import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTree = readFileSync(new URL('./route-tree.ts', import.meta.url), 'utf8');
const background = readFileSync(new URL('./background-location.tsx', import.meta.url), 'utf8');
const contractDetail = readFileSync(new URL('../../features/contracts/pages/ContractDetailPage.tsx', import.meta.url), 'utf8');
const ownerDetail = readFileSync(new URL('../../features/owners/owner-detail-page.tsx', import.meta.url), 'utf8');
const tenantDetail = readFileSync(new URL('../../features/tenants/components/TenantPreviewDialog.tsx', import.meta.url), 'utf8');
const personDetail = readFileSync(new URL('../../features/people/components/PersonDossier.tsx', import.meta.url), 'utf8');
const propertyDetail = readFileSync(new URL('../../features/properties/property-detail-page.tsx', import.meta.url), 'utf8');
const unitDetail = readFileSync(new URL('../../features/properties/units/property-unit-detail-page.tsx', import.meta.url), 'utf8');
const peopleNew = readFileSync(new URL('../../routes/_protected.people.new.tsx', import.meta.url), 'utf8');
const peopleEdit = readFileSync(new URL('../../routes/_protected.people.$personId.edit.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../../features/dashboard/components/needs-attention-section.tsx', import.meta.url), 'utf8');
const ownerPreview = readFileSync(new URL('../../features/owners/components/OwnerPreviewDialog.tsx', import.meta.url), 'utf8');
const ownerDossierBody = readFileSync(new URL('../../features/owners/components/owner-dossier-body.tsx', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const tenants = readFileSync(new URL('../../features/tenants/TenantsPage.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

describe('BackgroundLocation hardening', () => {
  it('provider tracks pathname + search + hash and explicit backgrounds', () => {
    expect(background).toContain('prev.pathname !== location.pathname');
    expect(background).toContain('JSON.stringify(prev.search)');
    expect(background).toContain('prev.hash !== location.hash');
    expect(background).toContain('backgroundLocation');
    expect(background).toContain('explicitBackground');
    expect(background).toContain('nextBackground = background ?? location');
  });
});

describe('Event bus removal', () => {
  it('no production consumer revives openEntityPreview', () => {
    for (const src of [dashboard, ownerPreview, ownerWorkspace, tenants, contractDetail, ownerDetail, tenantDetail, personDetail, propertyDetail, unitDetail]) {
      expect(src).not.toContain('openEntityPreview');
    }
  });

  it('legacy event bus files and the legacy previewKind redirect stay deleted', () => {
    expect(existsSync(new URL('../../components/ui/entity-preview-events.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../components/ui/entity-preview-host.tsx', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./legacy-preview-redirect.tsx', import.meta.url))).toBe(false);
    expect(protectedRoute).not.toContain('EntityPreviewHost');
    expect(protectedRoute).not.toContain('LegacyPreviewRedirect');
    expect(protectedRoute).toContain('BackgroundLocationProvider');
  });
});

describe('Heavyweight dossier presentation', () => {
  it('owner, tenant, contract, person, property and unit details are canonical full pages', () => {
    expect(routeTree).toContain("import('@/features/contracts/pages/ContractDetailPage')");
    expect(routeTree).toContain("import('@/features/owners/owner-detail-page')");
    expect(routeTree).toContain("import('@/features/tenants/components/TenantPreviewDialog')");
    expect(routeTree).toContain("import('@/features/people/components/PersonDossier')");
    expect(routeTree).toContain("import('@/features/properties/property-detail-page')");
    expect(routeTree).toContain("import('@/features/properties/units/property-unit-detail-page')");

    for (const src of [contractDetail, ownerDetail, tenantDetail, personDetail, propertyDetail, unitDetail]) {
      expect(src).not.toContain('useBackgroundLocation');
      expect(src).not.toContain('window.history.back()');
    }
  });
});

describe('People consistency', () => {
  it('people create/edit keep the modal workflow', () => {
    expect(peopleNew).toContain('PeopleListPage');
    expect(peopleNew).toContain('PersonFormModal');
    expect(peopleEdit).toContain('PeopleListPage');
    expect(peopleEdit).toContain('PersonFormModal');
    expect(peopleNew).toContain('useBackgroundLocation');
    expect(peopleEdit).toContain('useBackgroundLocation');
  });
});

describe('Permissions + canonical routes', () => {
  it('heavy details remain under protected routing and rely on protected data hooks/RLS', () => {
    expect(routeTree).toContain("path: '/contracts/$contractId'");
    expect(routeTree).toContain("path: '/owners/$ownerId'");
    expect(routeTree).toContain("path: '/tenants/$tenantId'");
    expect(routeTree).toContain("path: '/people/$personId'");
    expect(routeTree).toContain("path: '/properties/$propertyId'");
    // Route guards stay at route level; UI-level permission checks belong to the
    // feature pages (contract detail gates its actions with canAccess, by design).
    expect(routeTree).toContain("beforeLoad: requirePermission('owners.detail.view')");
  });

  it('canonical route navigation remains in related workspaces', () => {
    expect(dashboard).toContain("to: '/contracts/$contractId'");
    expect(tenants).toContain("to: '/contracts/$contractId'");
    expect(ownerPreview + ownerDossierBody).toContain("to: '/properties/$propertyId'");
    // Property navigation is not placed on directory rows; it happens from the
    // owner file/preview (canonical #1783 owner directory).
    expect(ownerWorkspace).not.toContain("to: '/properties/$propertyId'");
  });
});
