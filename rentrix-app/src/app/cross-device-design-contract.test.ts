import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('cross-device design unification', () => {
  const nav = source('app/layout/layout-navigation-view.tsx');
  const palette = source('features/command-palette/command-palette-trigger.tsx');
  const pageHeader = source('components/layout/page-header.tsx');
  const detailHeader = source('components/layout/entity-detail-header.tsx');
  const entityForm = source('components/ui/entity-form.tsx');
  const ux = source('styles/ux-foundation.css');
  const propertyDetail = source('features/properties/property-detail-page.tsx');
  const operationsHub = source('features/operations-hub/operations-hub-workspace.tsx');
  const financials = source('features/finance/FinancePage.tsx');
  const reports = source('features/reports/reports-page.tsx');
  const assistant = source('features/ai-assistant/ai-assistant-page.tsx');

  it('keeps one current floating dock with Menu, Search and utilities', () => {
    for (const hook of [
      'data-mobile-dock-menu',
      'data-mobile-dock-search',
      'data-mobile-dock-quick-add',
      'data-mobile-dock-notifications',
      'data-mobile-dock-ai',
    ]) expect(nav).toContain(hook);
    expect(nav).toContain('md:hidden');
  });

  it('keeps the floating mobile control on phones only', () => {
    expect(nav).toContain('data-mobile-floating-control');
    expect(nav).toContain('md:hidden');
    expect(nav).not.toContain('lg:hidden" data-mobile-floating-control');
  });

  it('exposes header search on tablet and desktop', () => {
    expect(palette).toContain('hidden md:flex');
    expect(palette).not.toContain('hidden lg:flex');
  });

  it('keeps page headers elevated while detail headers avoid a second card layer', () => {
    expect(pageHeader).toContain('rounded-2xl');
    expect(pageHeader).toContain('data-unified-surface="page-header"');
    expect(detailHeader).toContain('data-unified-surface="page-header"');
    expect(detailHeader).toContain('border-b border-border/70');
    expect(detailHeader).not.toContain('shadow-card');
    expect(detailHeader).not.toContain("'rounded-2xl border");
    expect(pageHeader).not.toContain('rounded-[1.5rem]');
    expect(detailHeader).not.toContain('rounded-[1.5rem]');
  });

  it('keeps entity forms as one responsive dialog surface with mobile-safe actions', () => {
    expect(entityForm).toContain('data-entity-form-surface="dialog"');
    expect(entityForm).toContain('max-h-[92dvh]');
    expect(entityForm).toContain('w-[min(calc(100vw-1rem),48rem)]');
    expect(entityForm).toContain('data-entity-form-actions');
    expect(entityForm).toContain('env(safe-area-inset-bottom,0px)');
    expect(entityForm).toContain('data-entity-form-section');
  });

  it('reserves floating-control clearance for phone widths only', () => {
    expect(ux).toContain('@media (max-width: 767px)');
    expect(ux).toContain('var(--mobile-floating-control-height)');
    expect(ux).not.toContain('@media (max-width: 1023px)');
  });

  it('renders property dossier content once for phone, tablet, and desktop', () => {
    expect(propertyDetail).toContain('data-property-detail-body');
    expect(propertyDetail).toContain('data-property-detail-mobile-nav');
    expect(propertyDetail.match(/data-property-detail-body/g) ?? []).toHaveLength(1);
    expect(propertyDetail).not.toContain('md:hidden\">\n            {tab ===');
  });

  it('keeps operational hubs on the same explicit workspace wave', () => {
    expect(operationsHub).toContain('visualVariant="malek-pro"');
    expect(financials).toContain('visualVariant="malek-pro"');
    expect(financials).toContain('data-finance-primary-nav');
    expect(reports).toContain('data-report-landing');
    expect(reports).toContain("translateSharedLabel('reportsPageDescription')");
    expect(financials).not.toContain('💡');
    expect(reports).not.toContain('💡');
  });

  it('shows AI starter actions and keeps Enter-to-send with the read-only disclaimer', () => {
    expect(assistant).toContain('const assistantActions = [');
    expect(assistant).toContain('assistantActions.map');
    // Enter sends, Shift+Enter inserts a newline — implemented on the keydown
    // handler instead of a visible hint chip.
    expect(assistant).toContain("event.key === 'Enter' && !event.shiftKey");
    expect(assistant).toContain('قراءة وتحليل فقط');
  });
});
