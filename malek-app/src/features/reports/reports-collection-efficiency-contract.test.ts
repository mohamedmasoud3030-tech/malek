import { describe, expect, it } from 'vitest';
import { readSource } from '../../test/read-source';

const source = (relativePath: string) =>
  readSource(import.meta.url, relativePath);

describe('Reports collection-efficiency authority contract', () => {
  it('uses rpt_dashboard_snapshot as the only authority for the reports rate', () => {
    const adapter = source('reports-collection-efficiency.ts');
    const workspace = source('use-reports-workspace.ts');

    expect(adapter).toContain("supabase.rpc('rpt_dashboard_snapshot'");
    expect(adapter).toContain('collections.collection_rate');
    expect(workspace).toContain('useAuthoritativeReportsCollectionRate');
    expect(workspace).toContain(
      'collectionRate: collectionRateQuery.data ?? 0',
    );
  });

  it('does not reintroduce period-cash / period-invoice arithmetic in either reports surface', () => {
    const overview = source('components/OverviewSection.tsx');
    const insights = source('reports-insights.ts');

    expect(overview).toContain('collectionRate: number | undefined;');
    expect(overview).not.toMatch(/paid\s*\/\s*invoiced/);
    expect(insights).not.toContain('safeRatio(params.paid, params.invoiced)');
    expect(insights).toContain('collectionRate: number;');
  });
});
