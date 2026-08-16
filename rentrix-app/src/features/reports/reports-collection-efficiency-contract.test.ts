import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) => readFileSync(resolve(import.meta.dirname, relativePath), 'utf8');

describe('Reports collection-efficiency authority contract', () => {
  it('uses rpt_dashboard_snapshot as the only authority for the reports rate', () => {
    const adapter = source('reports-collection-efficiency.ts');
    const workspace = source('use-reports-workspace.ts');

    expect(adapter).toContain("supabase.rpc('rpt_dashboard_snapshot'");
    expect(adapter).toContain('collections.collection_rate');
    expect(workspace).toContain('useAuthoritativeReportsCollectionRate');
    expect(workspace).toContain('collectionRate: collectionRateQuery.data ?? 0');
  });

  it('does not reintroduce period-cash / period-invoice arithmetic in either reports surface', () => {
    const hero = source('components/ReportsWorkspace.tsx');
    const insights = source('reports-insights.ts');

    expect(hero).toContain('const collectionRate = model.hero.collectionRate;');
    expect(hero).not.toMatch(/summary\?\.paid[\s\S]{0,120}summary\?\.invoiced/);
    expect(insights).not.toContain('safeRatio(params.paid, params.invoiced)');
    expect(insights).toContain('collectionRate: number;');
  });
});
