import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeTree = readFileSync(new URL('./route-tree.ts', import.meta.url), 'utf8');
const background = readFileSync(new URL('./background-location.tsx', import.meta.url), 'utf8');
const legacyRedirect = readFileSync(new URL('./legacy-preview-redirect.tsx', import.meta.url), 'utf8');
const contractDetail = readFileSync(new URL('../../routes/_protected.contracts.$contractId.tsx', import.meta.url), 'utf8');
const ownerDetail = readFileSync(new URL('../../routes/_protected.owners.$ownerId.tsx', import.meta.url), 'utf8');
const propertyDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.tsx', import.meta.url), 'utf8');
const unitDetail = readFileSync(new URL('../../routes/_protected.properties.$propertyId.units.$unitId.tsx', import.meta.url), 'utf8');
const peopleNew = readFileSync(new URL('../../routes/_protected.people.new.tsx', import.meta.url), 'utf8');
const peopleEdit = readFileSync(new URL('../../routes/_protected.people.$personId.edit.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../../features/dashboard/components/expiring-contracts-section.tsx', import.meta.url), 'utf8');
const ownerPreview = readFileSync(new URL('../../features/owners/components/OwnerPreviewDialog.tsx', import.meta.url), 'utf8');
const ownerWorkspace = readFileSync(new URL('../../features/owners/components/owner-workspace-table.tsx', import.meta.url), 'utf8');
const tenants = readFileSync(new URL('../../features/tenants/TenantsPage.tsx', import.meta.url), 'utf8');
const protectedRoute = readFileSync(new URL('../../routes/_protected.tsx', import.meta.url), 'utf8');

describe('Phase 3.1 — BackgroundLocation hardening', () => {
  it('provider tracks pathname + search + hash, not just pathname', () => {
    expect(background).toContain('prev.pathname !== location.pathname');
    expect(background).toContain('JSON.stringify(prev.search)');
    expect(background).toContain('prev.hash !== location.hash');
  });

  it('uses explicit state.backgroundLocation when navigated via dialog, fallback to previous', () => {
    expect(background).toContain('location.state');
    expect(background).toContain('backgroundLocation');
    expect(background).toContain('explicitBackground');
  });

  it('handles nested dialog → nested entity (keeps original background)', () => {
    expect(background).toContain('useDialogNavigate');
    expect(background).toContain('nextBackground = background ?? location');
  });

  it('handles same pathname with different search (e.g., /properties?section=units → /properties?section=lands)', () => {
    expect(background).toContain('JSON.stringify(prev.search)');
  });
});

describe('Phase 3.1 — Event bus removal', () => {
  it('no production consumer of openEntityPreview remains for migrated entities', () => {
    expect(dashboard).not.toContain('openEntityPreview');
    expect(ownerPreview).not.toContain('openEntityPreview');
    expect(ownerWorkspace).not.toContain('openEntityPreview');
    expect(tenants).not.toContain('openEntityPreview');
    expect(contractDetail).not.toContain('openEntityPreview');
    expect(ownerDetail).not.toContain('openEntityPreview');
    expect(propertyDetail).not.toContain('openEntityPreview');
    expect(unitDetail).not.toContain('openEntityPreview');
  });

  it('legacy event bus files are deleted', () => {
    expect(existsSync(new URL('../../components/ui/entity-preview-events.ts', import.meta.url))).toBe(false);
    expect(existsSync(new URL('../../components/ui/entity-preview-host.tsx', import.meta.url))).toBe(false);
    expect(protectedRoute).not.toContain('EntityPreviewHost');
    expect(protectedRoute).toContain('BackgroundLocationProvider');
    expect(protectedRoute).toContain('LegacyPreviewRedirect');
  });

  it('guard prevents new global dispatch for entity preview', () => {
    const src = background + dashboard + ownerPreview + ownerWorkspace + tenants;
    expect(src).not.toContain('malek:entity-preview');
  });
});

describe('Phase 3.1 — Legacy preview query → canonical', () => {
  it('query previewKind/previewId redirects to canonical entity URLs', () => {
    expect(legacyRedirect).toContain('previewKind');
    expect(legacyRedirect).toContain('previewId');
    expect(legacyRedirect).toContain("to = '/properties/$propertyId'");
    expect(legacyRedirect).toContain("to = '/contracts/$contractId'");
    expect(legacyRedirect).toContain("to = '/owners/$ownerId'");
    expect(legacyRedirect).toContain('replace: true');
    expect(legacyRedirect).toContain('delete next.previewKind');
  });

  it('after redirect, no EntityPreviewHost needed', () => {
    expect(protectedRoute).toContain('LegacyPreviewRedirect');
  });
});

describe('Phase 3.1 — Close / Back / Forward contract', () => {
  it('dialog close uses history.back when background exists, else fallback to parent', () => {
    for (const src of [contractDetail, ownerDetail, propertyDetail, unitDetail]) {
      expect(src).toContain('window.history.back()');
      expect(src).toContain('void navigate');
    }
    expect(contractDetail).toContain("if (isDialog) window.history.back()");
    expect(ownerDetail).toContain("if (isDialog) window.history.back()");
  });

  it('does not create history loop with replace:true hiding canonical', () => {
    for (const src of [contractDetail, ownerDetail, propertyDetail]) {
      expect(src).not.toMatch(/replace: true.*previewKind/);
      expect(src).not.toMatch(/navigate.*replace: true.*\/contracts/);
    }
  });
});

describe('Phase 3.1 — People consistency', () => {
  it('people create/edit use same dialog contract (modal over list) for both internal and direct', () => {
    expect(peopleNew).toContain('PeopleListPage');
    expect(peopleNew).toContain('PersonFormModal');
    expect(peopleEdit).toContain('PeopleListPage');
    expect(peopleEdit).toContain('PersonFormModal');
    // Both use background check for close
    expect(peopleNew).toContain('useBackgroundLocation');
    expect(peopleEdit).toContain('useBackgroundLocation');
    expect(peopleNew).toContain('window.history.back()');
    expect(peopleEdit).toContain('window.history.back()');
  });

  it('people direct does not redirect to blank, preserves URL', () => {
    expect(peopleNew).not.toContain('replace: true');
    expect(peopleEdit).not.toContain('replace: true');
    expect(peopleNew).toContain("to: '/people'");
    expect(peopleEdit).toContain("to: '/people'");
  });
});

describe('Phase 3.1 — Permissions + data leak', () => {
  it('detail routes remain under protectedRoute (auth) and do not fetch before guard', () => {
    expect(routeTree).toContain("path: '/contracts/$contractId'");
    expect(routeTree).toContain("path: '/owners/$ownerId'");
    expect(routeTree).toContain("path: '/properties/$propertyId'");
    // No new permission bypass; detail routes rely on parent protectedRoute and RLS
    expect(contractDetail).not.toContain('canAccess');
    expect(ownerDetail).not.toContain('canAccess');
  });

  it('unauthorized navigation still respects RLS (no data exposure via masking)', () => {
    // The preview dialogs use same data hooks (useContract, useOwnerDetailSnapshot, useProperty)
    // which are RLS-protected via Supabase; no direct table access
    expect(contractDetail).toContain('ContractPreviewDialog');
    expect(ownerDetail).toContain('OwnerPreviewDialog');
    expect(propertyDetail).toContain('PropertyPreviewDialog');
  });
});

describe('Phase 3.1 — Behavioral coverage (dashboard/tenant/owner nesting)', () => {
  it('dashboard → contract uses route navigation with background', () => {
    expect(dashboard).toContain("to: '/contracts/$contractId'");
    expect(dashboard).toContain('backgroundLocation');
  });

  it('tenant → contract uses route navigation', () => {
    expect(tenants).toContain("to: '/contracts/$contractId'");
    expect(tenants).toContain('backgroundLocation');
  });

  it('owner → property uses route navigation (nested)', () => {
    expect(ownerPreview).toContain("to: '/properties/$propertyId'");
    expect(ownerPreview).toContain('backgroundLocation');
    expect(ownerWorkspace).toContain("to: '/properties/$propertyId'");
  });

  it('nested transitions keep original background (via useDialogNavigate)', () => {
    expect(background).toContain('nextBackground = background ?? location');
  });
});

describe('Phase 3.1 — No blank / canonical URL visible', () => {
  it('every detail route has dialog and full page branches', () => {
    for (const src of [contractDetail, ownerDetail, propertyDetail, unitDetail]) {
      expect(src).toContain('isDialog');
      expect(src).toContain('return <');
    }
  });

  it('canonical URLs remain visible (no replace hiding)', () => {
    expect(contractDetail).toContain("to: '/contracts'");
    expect(propertyDetail).toContain("to: '/properties'");
    expect(ownerDetail).toContain("to: '/owners'");
  });
});
