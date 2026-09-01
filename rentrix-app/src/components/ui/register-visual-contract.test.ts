import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(uiDir, '../..');
const table = readFileSync(resolve(uiDir, 'table.tsx'), 'utf8');
const entityCard = readFileSync(resolve(uiDir, 'entity-card.tsx'), 'utf8');
const entityTable = readFileSync(resolve(uiDir, 'entity-table.tsx'), 'utf8');
const filterBar = readFileSync(resolve(uiDir, 'filter-bar.tsx'), 'utf8');
const embeddableWorkspace = readFileSync(resolve(srcDir, 'components/layout/embeddable-workspace.tsx'), 'utf8');
const listPage = readFileSync(resolve(srcDir, 'components/layout/list-page.tsx'), 'utf8');
const registerSummary = readFileSync(resolve(srcDir, 'components/layout/register-summary.tsx'), 'utf8');

describe('canonical register visual contract', () => {
  it('keeps natural-width semantic tables with a keyboard-reachable horizontal region when needed', () => {
    expect(table).toContain('min-w-max');
    expect(entityTable).toContain('data-entity-table-scroll');
    expect(entityTable).toContain('قابلة للتمرير أفقياً');
    expect(entityTable).toContain('mobile-scroll-x overflow-x-auto overscroll-x-contain touch-pan-x');
  });

  it('uses responsive viewport switching instead of a second data architecture', () => {
    expect(entityTable).toContain("type ResponsiveViewport = 'mobile' | 'tablet' | 'desktop'");
    expect(entityTable).toContain('function getViewportMode()');
    expect(entityTable).toContain('getDefaultViewMode(viewportMode)');
    expect(entityTable).toContain("viewport === 'mobile' ? 'cards' : 'table'");
    expect(entityTable).toContain('resolveTabletColumns');
    expect(entityTable).toContain('mobileSupportingKey?: string;');
    expect(entityTable).toContain('mobilePrimaryMetaKeys?: readonly string[];');
    expect(entityTable).toContain('mobileSecondaryMetaKeys?: readonly string[];');
    expect(entityTable).toContain('EntityTableViewModeProvider');
    expect(entityTable).toContain('sharedViewMode');
    expect(filterBar).toContain('EntityTableViewModeToggle');
    expect(filterBar).toContain('data-filter-view-mode');
    expect(embeddableWorkspace).toContain('EntityTableViewModeProvider');
  });

  it('enforces one page identity and deletes the legacy embedded-header API', () => {
    expect(embeddableWorkspace).toContain('const hasActions = Boolean(primaryAction || secondaryActions)');
    expect(embeddableWorkspace).not.toContain('embeddedHeader');
    expect(embeddableWorkspace).not.toContain('data-embedded-workspace-header');
    expect(embeddableWorkspace).not.toContain('<h2 className=');
    expect(listPage).not.toContain('embeddedHeader');
  });

  it('keeps sticky identity/actions for wide desktop only and trims lower-priority tablet columns', () => {
    expect(entityTable).toContain('xl:sticky xl:start-0');
    expect(entityTable).toContain('xl:sticky xl:end-0');
    expect(entityTable).toContain("column.resolvedPriority !== 'detail'");
    expect(entityTable).toContain('secondaryColumns.slice(0, stableColumns.length <= 4 ? 2 : 1)');
  });

  it('renders mobile rows as quiet card-style table rows without nested inner cards', () => {
    expect(entityCard).toContain('rounded-2xl');
    expect(entityCard).not.toContain('rounded-[16px]');
    expect(entityCard).toContain('border border-border/70 bg-card px-4 py-3');
    expect(entityCard).toContain('text-[15px] font-semibold');
    expect(entityCard).toContain('text-[12.5px] font-medium');
    expect(entityCard).toContain('min-h-5');
    expect(entityCard).toContain('ActionMenu');
    expect(entityCard).not.toContain('shadow-[0_16px_38px');
    expect(entityTable).toContain('className="grid gap-2.5" data-entity-table-mobile-list');
    const foundation = readFileSync(resolve(uiDir, '../../styles/ux-foundation.css'), 'utf8');
    expect(foundation).toContain('[data-entity-table-mobile-list],');
    expect(foundation).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('applies the shared mobile row contract on representative registers', () => {
    const properties = readFileSync(resolve(srcDir, 'features/properties/properties-list-page.tsx'), 'utf8');
    const units = readFileSync(resolve(srcDir, 'features/units/units-page.tsx'), 'utf8');
    const contracts = readFileSync(resolve(srcDir, 'features/contracts/components/ContractTable.tsx'), 'utf8');
    const invoices = readFileSync(resolve(srcDir, 'features/financials/components/invoice-list-section.tsx'), 'utf8');
    const maintenance = readFileSync(resolve(srcDir, 'features/maintenance/components/maintenance-list.tsx'), 'utf8');

    expect(properties).toContain('mobileCardType="property"');
    expect(properties).toContain('mobileSupportingKey="owner"');
    expect(properties).not.toContain('embeddedHeader');
    expect(units).toContain('mobileSupportingKey="property"');
    expect(contracts).toContain('mobileSupportingKey="tenant"');
    expect(invoices).toContain('mobilePrimaryMetaKeys={[\'remaining\', \'gross\', \'due_date\']}');
    expect(maintenance).toContain('mobileSupportingKey="location"');
  });

  it('keeps obsolete register headings deleted rather than hidden', () => {
    const owners = readFileSync(resolve(srcDir, 'features/owners/OwnersPage.tsx'), 'utf8');
    const receipts = readFileSync(resolve(srcDir, 'features/financials/receipts/receipts-page.tsx'), 'utf8');

    expect(registerSummary).not.toContain('RegisterHeading');
    expect(registerSummary).not.toContain('data-register-heading');
    expect(owners).not.toContain('RegisterHeading');
    expect(owners).not.toContain('سجل الملاك');
    expect(receipts).not.toContain('RegisterHeading');
    expect(receipts).not.toContain('سجل الإيصالات');
  });

  it('keeps register row actions under one visible action authority', () => {
    const properties = readFileSync(resolve(srcDir, 'features/properties/properties-list-page.tsx'), 'utf8');
    const tenants = readFileSync(resolve(srcDir, 'features/tenants/TenantsPage.tsx'), 'utf8');
    const invoices = readFileSync(resolve(srcDir, 'features/financials/components/invoice-list-section.tsx'), 'utf8');
    const maintenance = readFileSync(resolve(srcDir, 'features/maintenance/components/maintenance-list.tsx'), 'utf8');

    expect(properties).toContain("id: 'open'");
    expect(properties).not.toContain('aria-label={`فتح ملف ${property.title ?? "العقار"}`}');
    expect(tenants).toContain("id: 'contract'");
    expect(tenants).not.toContain('<Button variant="secondary" className="min-h-11 px-3" onClick={() => openContract');
    expect(invoices).toContain("id: 'collect'");
    expect(invoices).not.toContain('إجراءات إضافية للفاتورة');
    expect(maintenance).not.toContain('menuItems.length === 1');
  });
});
