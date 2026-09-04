import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Settings presents one pattern: the governance hub owns the page header and
 * the tab rail; every tab renders panel content beneath it. Company settings
 * must not swap in a second hero header, advanced tabs must not re-title
 * themselves inside duplicate cards, and the legacy company-wide preview dump
 * must not sit next to the sections that edit those very values.
 */
const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const hub = read('../governance-hub/components/GovernanceHubWorkspace.tsx');
const settingsPage = read('./settings-page.tsx');
const systemPage = read('../system/system-page.tsx');
const systemSection = read('./sections/SystemSection.tsx');
const costCentersSection = read('./cost-centers-settings-section.tsx');
const paymentTermsSection = read('./payment-terms-settings-section.tsx');

describe('settings hub single-chrome contract', () => {
  it('keeps one PageHeader for every settings tab', () => {
    expect(hub).toContain('<PageHeader title="الإعدادات" description={headerDescription} />');
    expect(hub).not.toContain("resolvedActiveTab !== 'company' ? (");
    expect(hub).toContain('governanceHubSections.find');
  });

  it('renders the cost-centers tab without a duplicated card header', () => {
    expect(hub).toMatch(/function CostCentersWorkspace\(\) \{\s*return <CostCentersSettingsSection \/>;/);
    expect(hub).not.toContain('مراكز التكلفة</CardTitle>');
    expect(hub).not.toContain('ضمن الصلاحية المخصصة');
    expect(hub).not.toContain('from \'@/components/ui/card\'');
  });

  it('skips the standalone settings hero when embedded in the hub', () => {
    expect(settingsPage).toContain('const showHero = variant !== \'embedded\';');
    expect(settingsPage).toContain('showHero ? <SettingsHero');
    expect(settingsPage).toContain('variant === \'embedded\' ? null : <SettingsHero');
  });

  it('keeps the embedded system tab focused: no decorative principles grid, no self-link to the company tab', () => {
    expect(systemPage).toContain("{variant === 'embedded' ? null : (");
    expect(systemPage).toContain("item.search?.section === 'company'");
    // The standalone compatibility presentation is untouched.
    expect(systemPage).toContain('governancePrinciples.map');
  });

  it('does not repeat company profile values inside the appearance section', () => {
    expect(systemSection).not.toContain('تفاصيل إعدادات الشركة');
    // The live preview that actually reflects theme changes stays.
    expect(systemSection).toContain('معاينة مباشرة');
  });
});

describe('settings destructive-action clarity', () => {
  it('confirms cost-center archiving instead of firing on one click', () => {
    expect(costCentersSection).toContain('ConfirmDialog');
    expect(costCentersSection).toContain('pendingArchive');
    expect(costCentersSection).toContain('أرشفة مركز التكلفة');
    // Archive is hidden for records that are already archived.
    expect(costCentersSection).toContain('costCenter.is_active === false ? null');
  });

  it('confirms payment-template archiving instead of firing on one click', () => {
    expect(paymentTermsSection).toContain('ConfirmDialog');
    expect(paymentTermsSection).toContain('pendingArchiveTerm');
    expect(paymentTermsSection).toContain('أرشفة القالب');
    expect(paymentTermsSection).toContain('term.is_active === false ? null');
  });
});
