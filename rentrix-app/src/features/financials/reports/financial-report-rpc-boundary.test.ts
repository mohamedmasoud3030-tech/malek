import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const featureDir = resolve(import.meta.dirname);
const authorityMigration = resolve(
  featureDir,
  '../../../../supabase/migrations/20260901000064_financial_report_rpc_permission_boundary.sql',
);
const catalogMigration = resolve(
  featureDir,
  '../../../../supabase/migrations/20260901000065_financial_reports_view_permission_catalog.sql',
);

describe('financial report RPC database authority', () => {
  it('enforces financial.reports.view on the canonical public report boundary', () => {
    const source = readFileSync(authorityMigration, 'utf8');

    expect(source).toContain("current_user_has_effective_app_permission('financial.reports.view')");
    expect(source).toContain('app_private.require_financial_reports_view()');

    for (const rpc of [
      'rpt_trial_balance',
      'rpt_income_statement',
      'rpt_balance_sheet',
      'rpt_general_ledger',
      'rpt_cash_flow',
      'rpt_vat_return',
      'rpt_cash_flow_gl',
    ]) {
      expect(source, `${rpc} must remain behind the canonical report permission gate`).toMatch(
        new RegExp(`create function public\\.${rpc}\\([\\s\\S]*?perform app_private\\.require_financial_reports_view\\(\\)`),
      );
    }
  });

  it('keeps sensitive legacy WP05 GL delegates out of the browser execution surface', () => {
    const source = readFileSync(authorityMigration, 'utf8');

    for (const signature of [
      'public.wp05_rpt_trial_balance_gl(date)',
      'public.wp05_rpt_balance_sheet_gl(date)',
      'public.wp05_rpt_profit_loss_gl(date,date)',
      'public.wp05_rpt_general_ledger_gl(date,date,text)',
    ]) {
      expect(source).toContain(`revoke all on function ${signature} from public, anon, authenticated;`);
      expect(source).toContain(`grant execute on function ${signature} to service_role;`);
    }
  });

  it('does not create new sprint/version-named report APIs', () => {
    const source = readFileSync(authorityMigration, 'utf8');
    expect(source).not.toMatch(/create\s+(?:or\s+replace\s+)?function\s+(?:public|app_private)\.wp\d+_/i);
    expect(source).not.toMatch(/create\s+(?:or\s+replace\s+)?function\s+[^\s(]+_impl\s*\(/i);
  });

  it('keeps financial.reports.view in the assignable permission catalog', () => {
    const source = readFileSync(catalogMigration, 'utf8');
    expect(source).toContain("('financial.reports.view', 'عرض التقارير المالية', false, true)");
  });
});
