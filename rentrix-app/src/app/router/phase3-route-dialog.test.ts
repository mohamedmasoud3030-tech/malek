import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTree = readFileSync(new URL('./route-tree.ts', import.meta.url), 'utf8');
const contractDetail = readFileSync(new URL('../../routes/_protected.contracts.$contractId.tsx', import.meta.url), 'utf8');
const ownerDetail = readFileSync(new URL('../../routes/_protected.owners.$ownerId.tsx', import.meta.url), 'utf8');
const tenantDetail = readFileSync(new URL('../../routes/_protected.tenants.$tenantId.tsx', import.meta.url), 'utf8');
const personDetail = readFileSync(new URL('../../routes/_protected.people.$personId.tsx', import.meta.url), 'utf8');
const propertyDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.tsx', import.meta.url), 'utf8');
const propertyOverview = readFileSync(new URL('../../routes/_protected.properties.$propertyId.index.tsx', import.meta.url), 'utf8');
const unitDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.units.$unitId.tsx', import.meta.url), 'utf8');
const peopleNew = readFileSync(new URL('../../routes/_protected.people.new.tsx', import.meta.url), 'utf8');
const peopleEdit = readFileSync(new URL('../../routes/_protected.people.$personId.edit.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const backgroundProvider = readFileSync(new URL('./background-location.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

describe('Route-native entity presentation', () => {
  it('keeps people create/edit as route-native modal workflows', () => {
    expect(routeTree).toContain("path: '/people/new'");
    expect(routeTree).toContain("path: '/people/$personId/edit'");
    expect(peopleNew).toContain('PeopleListPage');
    expect(peopleNew).toContain('PersonFormModal');
    expect(peopleEdit).toContain('PeopleListPage');
    expect(peopleEdit).toContain('PersonFormModal');
  });

  it('opens heavyweight dossiers as full pages only', () => {
    expect(contractDetail).toContain('ContractDetailPage');
    expect(ownerDetail).toContain('OwnerDetailPage');
    expect(tenantDetail).toContain('TenantDetailPage');
    expect(personDetail).toContain('PersonDetailPage');
    expect(propertyDetail).toContain('PropertyDetailPage');
    expect(unitDetail).toContain('PropertyUnitDetailPage');

    for (const src of [contractDetail, ownerDetail, tenantDetail, personDetail, propertyDetail, unitDetail]) {
      expect(src).not.toContain('useBackgroundLocation');
      expect(src).not.toContain('PreviewDialog');
      expect(src).not.toContain('isDialog');
      expect(src).not.toContain('window.history.back()');
      expect(src).not.toContain('openEntityPreview');
    }
  });

  it('property overview remains nested inside the canonical property detail workspace', () => {
    expect(propertyOverview).toContain('PropertyOverview');
    expect(routeTree).toContain("path: '/properties/$propertyId'");
    expect(routeTree).toContain("path: '/units/$unitId'");
  });

  it('list controllers use canonical route navigation instead of the legacy event bus', () => {
    expect(propertyController).toContain("to: '/properties/$propertyId'");
    expect(unitController).toContain("to: '/properties/$propertyId/units/$unitId'");
    expect(propertyController).not.toContain('openEntityPreview');
    expect(unitController).not.toContain('openEntityPreview');
  });

  it('background-location infrastructure remains for modal create/edit and lightweight preview workflows', () => {
    expect(backgroundProvider).toContain('BackgroundLocationProvider');
    expect(backgroundProvider).toContain('useBackgroundLocation');
    expect(backgroundProvider).toContain('useIsDialogRoute');
    expect(protectedRoute).toContain('BackgroundLocationProvider');
  });

  it('canonical heavyweight detail URLs stay directly addressable', () => {
    expect(routeTree).toContain("path: '/contracts/$contractId'");
    expect(routeTree).toContain("path: '/owners/$ownerId'");
    expect(routeTree).toContain("path: '/tenants/$tenantId'");
    expect(routeTree).toContain("path: '/people/$personId'");
    expect(routeTree).toContain("path: '/properties/$propertyId'");
    expect(contractDetail).toContain('if (!contractId) return null');
    expect(ownerDetail).toContain('if (!ownerId) return null');
    expect(tenantDetail).toContain('if (!tenantId) return null');
    expect(personDetail).toContain('if (!personId) return null');
    expect(unitDetail).toContain('if (!unitId) return null');
  });

  it('no migrated detail route revives the global preview event bus', () => {
    for (const src of [contractDetail, ownerDetail, tenantDetail, personDetail, propertyDetail, unitDetail, propertyOverview]) {
      expect(src).not.toContain('openEntityPreview');
    }
  });
});
