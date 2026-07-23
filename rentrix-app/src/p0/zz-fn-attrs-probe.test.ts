import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';

export const P0_TOUCHED_FUNCTIONS = [
  'rpt_cash_flow', 'rpt_dashboard_overview', 'rpt_daily_collection', 'rpt_vat_return',
  'rpt_financial_summary', 'rpt_trial_balance', 'rpt_income_statement', 'rpt_balance_sheet',
  'rpt_owner_statement', 'rpt_tenant_statement', 'rpt_aged_receivables', 'rpt_overdue_invoices',
  'rpt_rent_roll', 'create_owner_settlement_draft_atomic', 'record_invoice_payment_atomic',
  'post_receipt_atomic', 'update_contract_balance_from_allocation', 'create_owner_agreement_atomic',
] as const;

/** Effective per-function attributes on pre-P0 main (fix/generator input). */
describe('p0 function attributes probe', () => {
  it('dumps effective security/search_path attrs for the 19 P0-touched functions (pre-fix)', async () => {
    const { db } = await createReplayedDatabase();
    const { rows } = await db.query(
      `SELECT p.proname AS name,
              pg_get_function_identity_arguments(p.oid) AS args,
              p.prosecdef AS security_definer,
              coalesce(p.proconfig::text, '') AS proconfig
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = ANY($1)
        ORDER BY 1`,
      [P0_TOUCHED_FUNCTIONS as unknown as string[]],
    );
    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(join(evidenceDir, 'fn-effective-attrs.json'), JSON.stringify(rows, null, 2));
    console.log(JSON.stringify(rows, null, 2));
    expect(rows).toHaveLength(P0_TOUCHED_FUNCTIONS.length);
  }, 600_000);
});
