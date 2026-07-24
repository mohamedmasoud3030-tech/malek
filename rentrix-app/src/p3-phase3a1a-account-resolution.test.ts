import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sql=readFileSync(resolve(process.cwd(),'../supabase/migrations/20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql'),'utf8');
describe('Phase 3A-1A canonical accounts contract',()=>{
 it('defines fail-closed company helpers',()=>{expect(sql).toContain('require_company_account_id');expect(sql).toContain('ensure_company_account');expect(sql).toContain('pg_advisory_xact_lock');expect(sql).toContain("'coa:'||p_company_id::text");});
 it('redefines only expenses and deposits with per-company resolution',()=>{for(const n of ['create_expense_with_journal_atomic','update_expense_with_journal_atomic','create_deposit_atomic','deduct_deposit_atomic','refund_deposit_atomic'])expect(sql).toContain(n); expect(sql).toContain("ensure_company_account(v_company_id, '1111'");expect(sql).toContain("ensure_company_account(v_company_id, '2200'");expect(sql).toContain("ensure_company_account(v_company_id, '6100'");});
});
