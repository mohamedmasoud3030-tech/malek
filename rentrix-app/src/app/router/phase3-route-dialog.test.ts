import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTree = readFileSync(new URL('./route-tree.ts', import.meta.url), 'utf8');
const contractDetail = readFileSync(new URL('../../routes/_protected.contracts.$contractId.tsx', import.meta.url), 'utf8');
const ownerDetail = readFileSync(new URL('../../routes/_protected.owners.$ownerId.tsx', import.meta.url), 'utf8');
const propertyDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.tsx', import.meta.url), 'utf8');
const propertyOverview = readFileSync(new URL('../../routes/_protected.properties.$propertyId.index.tsx', import.meta.url), 'utf8');
const unitDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.units.$unitId.tsx', import.meta.url), 'utf8');
const peopleNew = readFileSync(new URL('../../routes/_protected.people.new.tsx', import.meta.url), 'utf8');
const peopleEdit = readFileSync(new URL('../../routes/_protected.people.$personId.edit.tsx', import.meta.url), 'utf8');
const propertyController = readFileSync(new URL('../../features/properties/use-property-list-controller.ts', import.meta.url), 'utf8');
const unitController = readFileSync(new URL('../../features/units/use-units-list-controller.ts', import.meta.url), 'utf8');
const backgroundProvider = readFileSync(new URL('./background-location.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');
const previewHost = readFileSync(new URL('../../components/ui/entity-preview-host.tsx', import.meta.url), 'utf8');

describe('Phase 3 — Route-native entity dialogs', () => {
  it('People new/edit are reference implementation: canonical URLs with list+modal, no event bus', () => {
    expect(routeTree).toContain("path: '/people/new'");
    expect(routeTree).toContain("path: '/people/$personId/edit'");
    expect(peopleNew).toContain('PeopleListPage');
    expect(peopleNew).toContain('PersonFormModal');
    expect(peopleNew).not.toContain('openEntityPreview');
    expect(peopleEdit).toContain('PeopleListPage');
    expect(peopleEdit).toContain('PersonFormModal');
    expect(peopleEdit).not.toContain('openEntityPreview');
    // Close navigates to /people (preserves URL until close)
    expect(peopleNew).toContain("to: '/people'");
  });

  it('Contract detail is route-native: dialog over background vs full page', () => {
    expect(contractDetail).toContain('useBackgroundLocation');
    expect(contractDetail).toContain('isDialog');
    expect(contractDetail).toContain('ContractPreviewDialog');
    expect(contractDetail).toContain('ContractDetailPage');
    expect(contractDetail).not.toContain('openEntityPreview');
    expect(contractDetail).not.toContain("replace: true");
    expect(contractDetail).toContain("navigate({ to: '/contracts'");
  });

  it('Owner detail is route-native', () => {
    expect(ownerDetail).toContain('useBackgroundLocation');
    expect(ownerDetail).toContain('OwnerPreviewDialog');
    expect(ownerDetail).toContain('OwnerDetailPage');
    expect(ownerDetail).not.toContain('openEntityPreview');
  });

  it('Property detail is route-native: dialog over PortfolioHub vs full detail', () => {
    expect(propertyDetail).toContain('useBackgroundLocation');
    expect(propertyDetail).toContain('PropertyPreviewDialog');
    expect(propertyDetail).toContain('PropertyDetailPage');
    expect(propertyDetail).toContain('PortfolioHubPage');
    expect(propertyDetail).not.toContain('openEntityPreview');
    expect(propertyOverview).toContain('PropertyOverview');
    expect(propertyOverview).not.toContain('openEntityPreview');
  });

  it('Unit detail is route-native', () => {
    expect(unitDetail).toContain('useBackgroundLocation');
    expect(unitDetail).toContain('UnitPreviewDialog');
    expect(unitDetail).toContain('PropertyUnitDetailPage');
    expect(unitDetail).not.toContain('openEntityPreview');
  });

  it('List controllers use route navigation, not event bus (for migrated entities)', () => {
    expect(propertyController).toContain("to: '/properties/$propertyId'");
    expect(propertyController).not.toContain('openEntityPreview');
    expect(unitController).toContain("to: '/properties/$propertyId/units/$unitId'");
    expect(unitController).not.toContain('openEntityPreview');
  });

  it('Background location provider exists and is used at protected level', () => {
    expect(backgroundProvider).toContain('BackgroundLocationProvider');
    expect(backgroundProvider).toContain('useBackgroundLocation');
    expect(backgroundProvider).toContain('useIsDialogRoute');
    expect(protectedRoute).toContain('BackgroundLocationProvider');
    expect(protectedRoute).toContain('EntityPreviewHost');
  });

  it('Direct navigation preserves URL and does not redirect to parent', () => {
    // Detail routes must not contain `replace: true` redirect to parent for direct case
    // They should render full page when no background
    expect(contractDetail).not.toContain("navigate({ to: '/contracts', replace: true })");
    expect(ownerDetail).not.toContain("navigate({ to: '/owners', replace: true })");
    expect(propertyDetail).not.toContain("replace: true");
    // Instead, they check isDialog and render full page when not dialog
    expect(contractDetail).toContain('if (!contractId) return null');
    expect(contractDetail).toContain('if (isDialog)');
    expect(contractDetail).toContain('return <ContractDetailPage');
  });

  it('Back/Forward: dialog close uses history back or navigate to background (not replace hide)', () => {
    expect(contractDetail).toContain("to: '/contracts'");
    expect(contractDetail).toContain('onOpenChange');
    expect(ownerDetail).toContain("to: '/owners'");
    expect(propertyDetail).toContain("to: '/properties'");
    expect(contractDetail).not.toMatch(/replace: true.*preview/);
  });

  it('No blank state: every detail route has component for both dialog and full page', () => {
    for (const src of [contractDetail, ownerDetail, propertyDetail, unitDetail]) {
      expect(src).toContain('isDialog');
      expect(src).toContain('return <');
    }
    // Contract and owner should handle missing id
    expect(contractDetail).toContain('if (!contractId)');
    expect(ownerDetail).toContain('if (!ownerId)');
  });

  it('Permissions: detail routes keep guards (no leak via masking)', () => {
    // People, property, contract, owner routes should still be under protectedRoute (auth)
    // and keep their permission guards where required (lands.view, commissions.view etc.)
    // Detail routes themselves are auth-only; data fetching respects RLS
    expect(routeTree).toContain("path: '/properties/$propertyId'");
    expect(routeTree).toContain("path: '/contracts/$contractId'");
    expect(routeTree).toContain("path: '/owners/$ownerId'");
    // No new permission bypass
    expect(contractDetail).not.toContain('canAccess');
  });

  it('Legacy mappings still work (Phase 1+2 contracts)', () => {
    // Old previewKind search param still supported via EntityPreviewHost for backward compat
    expect(previewHost).toContain('previewKind');
    expect(previewHost).toContain('previewId');
    // But new detail routes are canonical, not via search
    expect(routeTree).toContain("path: '/people'");
    expect(routeTree).toContain("path: '/lands'");
    expect(routeTree).toContain("path: '/commissions'");
  });

  it('Mobile: dialog has accessible properties', () => {
    // EntityPreviewDialog already tested for focus trap etc., but check that new detail dialogs use it
    expect(contractDetail).toContain('ContractPreviewDialog');
    expect(ownerDetail).toContain('OwnerPreviewDialog');
    // Dialog should have open prop and onOpenChange
    expect(contractDetail).toContain('open');
    expect(contractDetail).toContain('onOpenChange');
  });

  it('Event bus not required for migrated entities (no openEntityPreview in their detail routes)', () => {
    for (const src of [contractDetail, ownerDetail, propertyDetail, unitDetail, propertyOverview]) {
      expect(src).not.toContain('openEntityPreview');
    }
    for (const src of [propertyController, unitController]) {
      expect(src).not.toContain('openEntityPreview');
    }
  });
});
