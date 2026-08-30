import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

function workspaceModules(extension?: '.ts' | '.tsx'): string[] {
  return readdirSync(workspaceDir).filter(
    (file) => isSourceModule(file) && (!extension || file.endsWith(extension)),
  );
}

function adapterModules(): string[] {
  return readdirSync(resolve(workspaceDir, 'adapters'))
    .filter(isSourceModule)
    .map((file) => `adapters/${file}`);
}

describe('WP-C C.1 — workspace is split by responsibility', () => {
  it('keeps the shell and panel router small while owner navigation stays task-first', () => {
    const shell = resolve(workspaceDir, 'ReportsShell.tsx');
    const panel = resolve(workspaceDir, 'ReportsViewPanel.tsx');
    const root = resolve(workspaceDir, 'ReportsWorkspace.tsx');

    for (const file of [shell, panel, root]) {
      expect(lineCount(file)).toBeLessThan(300);
    }

    const shellSource = read(shell);
    expect(shellSource).toContain('ReportsFilterSurface');
    expect(shellSource).toContain('MetricButton');
    expect(shellSource).toContain('data-report-summary-layer');
    expect(shellSource).not.toContain('FinanceKpiGrid');
    expect(shellSource).not.toContain('SectionTabs');

    const rootSource = read(root);
    expect(rootSource).not.toContain('ReportsSectionTabs');
    expect(rootSource).not.toContain('SectionTabs');

    const panelSource = read(panel);
    expect(panelSource).toContain('AccountingReportsAdapter');
    expect(panelSource).toContain('StatementsReportsAdapter');
    expect(panelSource).toContain('AnalyticsReportsAdapter');
  });

  it('uses canonical report owners without compatibility shims', () => {
    expect(existsSync(resolve(reportsDir, 'workspace/ReportsWorkspace.tsx'))).toBe(true);
    expect(existsSync(resolve(reportsDir, 'directory/ReportDirectory.tsx'))).toBe(true);
    expect(existsSync(resolve(reportsDir, 'components/ReportsWorkspace.tsx'))).toBe(false);
    expect(existsSync(resolve(reportsDir, 'components/ReportDirectory.tsx'))).toBe(false);
  });
});

describe('WP-C C.4 — every adapter chunk is lazy', () => {
  it('lazy-imports all three internal adapters so an inactive section is never downloaded', () => {
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

    expect(lazyBodyImports.reduce((total, entry) => total + entry.count, 0)).toBe(16);

    for (const { file, source } of adapterModules()
      .filter((name) => name.endsWith('.tsx'))
      .map((name) => ({ file: name, source: read(resolve(workspaceDir, name)) }))) {
      expect(source, file).not.toMatch(/^import \{[^}]*Section[^}]*\} from '\.\.\/\.\.\/components\//m);
    }
  });
});

describe('WP-C — the view registry is the only declaration of an internal report view', () => {
  it('registers every supported sub-view exactly once per internal adapter section', () => {
    expect(getReportSubViews('accounting').map((view) => view.id)).toEqual(
      ACCOUNTING_REPORT_VIEWS.map((view) => view.id),
    );
    expect(getReportSubViews('analytics').map((view) => view.id)).toEqual(
      ANALYTICS_REPORT_VIEWS.map((view) => view.id),
    );
    expect(getReportSubViews('statements')).toEqual([]);
  });

  it('preserves specialist deep links without exposing implementation categories in the workspace', () => {
    expect(ACCOUNTING_REPORT_VIEWS.map((view) => view.id)).toEqual([
      'accounting_reports',
      'general_ledger',
      'deferred_revenue',
    ]);
    expect(ANALYTICS_REPORT_VIEWS.map((view) => view.id)).toEqual([
      'overview',
      'collections',
      'overdue',
      'follow_up',
      'collection_movement',
      'expenses',
      'property_analytics',
      'occupancy',
      'expiring',
      'maintenance_analytics',
      'operations_overview',
      'services',
    ]);
    expect(read(resolve(workspaceDir, 'ReportsWorkspace.tsx'))).not.toContain('SectionTabs');
  });

  it('keeps every registered view reachable through both deep-link forms', () => {
    for (const view of ACCOUNTING_REPORT_VIEWS) {
      expect(resolveReportLocation(view.id, undefined)).toEqual({ section: 'accounting', view: view.id });
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
    expect(shell).not.toMatch(/summary\?\.paid[\s\S]{0,120}summary\?\.invoiced/);
  });
});