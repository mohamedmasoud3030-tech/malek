import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveReportLocation } from '../reports-section-model';
import {
  ACCOUNTING_REPORT_VIEWS,
  ANALYTICS_REPORT_VIEWS,
  getReportSubViews,
} from '../report-view-registry';

const workspaceDir = resolve(import.meta.dirname);
const reportsDir = resolve(workspaceDir, '..');
const read = (path: string) => readFileSync(path, 'utf8');
const lineCount = (path: string) => read(path).split('\n').length;

const isSourceModule = (file: string) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file);

/** Workspace modules relative to the workspace directory. */
function workspaceModules(extension?: '.ts' | '.tsx'): string[] {
  return readdirSync(workspaceDir).filter(
    (file) => isSourceModule(file) && (!extension || file.endsWith(extension)),
  );
}

/** Adapter modules relative to the workspace directory. */
function adapterModules(): string[] {
  return readdirSync(resolve(workspaceDir, 'adapters'))
    .filter(isSourceModule)
    .map((file) => `adapters/${file}`);
}

describe('WP-C C.1 — workspace is split by responsibility', () => {
  it('keeps the shell, the navigation and the panel router each small and single-purpose', () => {
    const shell = resolve(workspaceDir, 'ReportsShell.tsx');
    const tabs = resolve(workspaceDir, 'ReportsSectionTabs.tsx');
    const panel = resolve(workspaceDir, 'ReportsViewPanel.tsx');
    const root = resolve(workspaceDir, 'ReportsWorkspace.tsx');

    for (const file of [shell, tabs, panel, root]) {
      expect(lineCount(file)).toBeLessThan(300);
    }

    // Shell owns the scope bar + decision board + error surface, nothing else.
    const shellSource = read(shell);
    expect(shellSource).toContain('ReportsFilterSurface');
    expect(shellSource).toContain('FinanceKpiGrid');
    expect(shellSource).not.toContain('SectionTabs');

    // Navigation owns section/view switching only — it renders no report body.
    const tabsSource = read(tabs);
    expect(tabsSource).toContain('getReportSubViews');
    expect(tabsSource).not.toMatch(/from '\.\.\/components\//);

    // The router owns lazy adapter selection only.
    const panelSource = read(panel);
    expect(panelSource).toContain('AccountingReportsAdapter');
    expect(panelSource).toContain('StatementsReportsAdapter');
    expect(panelSource).toContain('AnalyticsReportsAdapter');
  });

  it('keeps the historical component import paths working through compatibility seams', () => {
    const workspaceShim = read(resolve(reportsDir, 'components/ReportsWorkspace.tsx'));
    const directoryShim = read(resolve(reportsDir, 'components/ReportDirectory.tsx'));

    expect(workspaceShim).toContain("from '../workspace/ReportsWorkspace'");
    expect(directoryShim).toContain("from '../directory/ReportDirectory'");
  });
});

describe('WP-C C.4 — every adapter chunk is lazy', () => {
  it('lazy-imports all three section adapters so an inactive section is never downloaded', () => {
    const panel = read(resolve(workspaceDir, 'ReportsViewPanel.tsx'));
    const lazyImports = panel.match(/lazy\(\(\) =>/g) ?? [];

    expect(lazyImports).toHaveLength(3);
    expect(panel).toContain("import('./adapters/AccountingReportsAdapter')");
    expect(panel).toContain("import('./adapters/StatementsReportsAdapter')");
    expect(panel).toContain("import('./adapters/AnalyticsReportsAdapter')");
    expect(panel).toContain('Suspense');
  });

  it('keeps every report body its own lazy chunk instead of bundling them into the adapter', () => {
    const lazyBodyImports = adapterModules()
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => ({ file, source: read(resolve(workspaceDir, file)) }))
      .map(({ file, source }) => ({ file, count: (source.match(/lazy\(\(\) =>/g) ?? []).length }));

    // 3 accounting bodies + 1 statements body + 7 analytics bodies.
    expect(lazyBodyImports.reduce((total, entry) => total + entry.count, 0)).toBe(11);

    for (const { file, source } of adapterModules()
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => ({ file: name, source: read(resolve(workspaceDir, name)) }))) {
      // No eager `import { XSection } from '../../components/...'` — that would
      // collapse the per-report code split back into one adapter chunk.
      expect(source, file).not.toMatch(/^import \{[^}]*Section[^}]*\} from '\.\.\/\.\.\/components\//m);
    }
  });
});

describe('WP-C — the view registry is the only declaration of a report view', () => {
  it('registers every sub-view exactly once per section', () => {
    expect(getReportSubViews('accounting').map((view) => view.id)).toEqual(
      ACCOUNTING_REPORT_VIEWS.map((view) => view.id),
    );
    expect(getReportSubViews('analytics').map((view) => view.id)).toEqual(
      ANALYTICS_REPORT_VIEWS.map((view) => view.id),
    );
    expect(getReportSubViews('statements')).toEqual([]);
  });

  it('keeps every registered view reachable through both deep-link forms', () => {
    for (const view of ACCOUNTING_REPORT_VIEWS) {
      // Legacy bookmark: ?section=<viewId>
      expect(resolveReportLocation(view.id, undefined)).toEqual({ section: 'accounting', view: view.id });
      // Canonical deep link: ?section=accounting&view=<viewId>
      expect(resolveReportLocation('accounting', view.id)).toEqual({ section: 'accounting', view: view.id });
    }

    for (const view of ANALYTICS_REPORT_VIEWS) {
      expect(resolveReportLocation(view.id, undefined)).toEqual({ section: 'analytics', view: view.id });
      expect(resolveReportLocation('analytics', view.id)).toEqual({ section: 'analytics', view: view.id });
    }
  });

  it('does not hardcode a second list of view ids anywhere in the workspace', () => {
    for (const file of workspaceModules('.tsx')) {
      const source = read(resolve(workspaceDir, file));
      expect(source, file).not.toContain("'accounting_reports',");
      expect(source, file).not.toContain("'maintenance_analytics',");
    }
  });
});

describe('WP-C — reports stays a presentation layer, never a second source of truth', () => {
  it('keeps every workspace and adapter module free of report-service and data-plane imports', () => {
    for (const file of [...workspaceModules(), ...adapterModules()]) {
      const source = read(resolve(workspaceDir, file));
      expect(source, file).not.toMatch(/from '@\/features\/(accounting|financials)\/[^']*([Ss]ervice|useFinancialReports)/);
      expect(source, file).not.toContain('supabase.');
    }
  });

  it('reads every headline figure from the authoritative workspace model', () => {
    const shell = read(resolve(workspaceDir, 'ReportsShell.tsx'));
    expect(shell).toContain('const collectionRate = model.hero.collectionRate;');
    // No period-cash / period-invoice ratio arithmetic in the presentation shell.
    expect(shell).not.toMatch(/summary\?\.paid[\s\S]{0,120}summary\?\.invoiced/);
  });
});
