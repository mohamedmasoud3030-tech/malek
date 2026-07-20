import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  import.meta.dirname,
  '../../../../../supabase/migrations/20260720180600_reconcile_expense_write_fields.sql',
);
const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

describe('expense atomic RPC field contract', () => {
  it('uses target-column identifier types instead of forcing UUID casts', () => {
    expect(sql).toContain('v_property_id public.expenses.property_id%type');
    expect(sql).toContain('v_cost_center_id public.expenses.cost_center_id%type');
    expect(sql).toContain('v_contract_id public.expenses.contract_id%type');
    expect(sql).not.toContain("v_property_id uuid := nullif(p_payload->>'property_id', '')::uuid");
  });

  it('persists every field exposed by the expense edit form', () => {
    expect(sql).toContain('property_id = v_property_id');
    expect(sql).toContain('cost_center_id = v_cost_center_id');
    expect(sql).toContain('contract_id = v_contract_id');
    expect(sql).toContain('expense_date = v_expense_date');
    expect(sql).toContain('date_time = v_expense_date::text');
    expect(sql).toContain('charged_to = v_charged_to');
  });

  it('creates balanced reversal and replacement entries for amount or date changes', () => {
    expect(sql).toContain('if v_amount_changed or v_date_changed then');
    expect(sql).toContain("'credit', v_expense_id, 'expense_reversal'");
    expect(sql).toContain("'debit', v_expense_id, 'expense_reversal'");
    expect(sql).toContain("'debit', v_expense_id, 'expense_update'");
    expect(sql).toContain("'credit', v_expense_id, 'expense_update'");
  });

  it('retains authorization, idempotency, audit, and execute grants', () => {
    expect(sql).toContain('public.is_admin_or_manager()');
    expect(sql).toContain('financial_operation_idempotency');
    expect(sql).toContain('insert into public.audit_log');
    expect(sql).toContain('grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role');
  });
});
