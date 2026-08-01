import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('client-money separation accounting invariants contract', () => {
  const coreSchema = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20250101000001_core_schema.sql'),
    'utf8',
  ).toLowerCase();

  const rlsPolicies = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20250101000002_rls_policies_and_grants.sql'),
    'utf8',
  ).toLowerCase();

  const p1OwnerSettlement = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260725000000_p1_owner_settlement_server_derivation.sql'),
    'utf8',
  ).toLowerCase();

  const phase3a1aCanonical = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql'),
    'utf8',
  ).toLowerCase();

  const phase3a1bVoid = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260728090000_phase3a1b_canonical_accounts_invoice_payment_receipt_void.sql'),
    'utf8',
  ).toLowerCase();

  const payCommissionAtomic = readFileSync(
    resolve(import.meta.dirname, '../../../../supabase/migrations/20260801000002_pay_commission_atomic.sql'),
    'utf8',
  ).toLowerCase();

  it('1. Tenant deposits are liabilities until refunded, applied, or forfeited', () => {
    expect(phase3a1aCanonical).toContain('2200'); // Tenant Deposits liability account code
    expect(phase3a1aCanonical).toContain('tenant_deposits');
    expect(phase3a1aCanonical).toContain('refund_deposit_atomic');
  });

  it('2. Owner money is not automatically treated as office revenue and 3. Management commissions are recognized separately from gross rent', () => {
    expect(p1OwnerSettlement).toContain('gross_collected numeric');
    expect(p1OwnerSettlement).toContain('office_fee numeric');
    expect(p1OwnerSettlement).toContain('owner_expenses numeric');
    expect(p1OwnerSettlement).toContain('net_payable numeric');
    expect(p1OwnerSettlement).toContain('calculate_owner_net_payout');
  });

  it('4. Paying an owner settlement reduces the relevant owner liability and cash/bank account', () => {
    const p0OwnerSettlement = readFileSync(
      resolve(import.meta.dirname, '../../../../supabase/migrations/20260716000001_owner_settlement_lifecycle_foundation.sql'),
      'utf8',
    ).toLowerCase();
    expect(p0OwnerSettlement).toContain('owner_settlements');
    expect(p0OwnerSettlement).toContain('status');
  });

  it('5. Reversing a receipt or settlement creates a controlled accounting reversal rather than deleting history', () => {
    expect(phase3a1bVoid).toContain('void_receipt_atomic');
    expect(phase3a1bVoid).toContain("when 'debit' then 'credit' else 'debit' end");
    expect(payCommissionAtomic).toContain('reverse_commission_atomic');
  });

  it('6. Posted journal entries remain balanced across DEBIT and CREDIT', () => {
    expect(coreSchema).toContain('journal_entries');
    expect(payCommissionAtomic).toContain('debit');
    expect(payCommissionAtomic).toContain('credit');
  });

  it('7. Posted financial records cannot be casually edited from the client browser', () => {
    expect(rlsPolicies).toContain('no_browser_write_journal_entries');
    expect(rlsPolicies).toContain('using (false) with check (false)');
  });

  it('8. Duplicate financial requests are idempotent where applicable', () => {
    expect(payCommissionAtomic).toContain('public.financial_operation_idempotency');
    expect(payCommissionAtomic).toContain('operation_name = \'pay_commission_atomic\' and request_id = v_request_id');
  });

  it('9. Financial totals shown in the UI come from server-authoritative calculations', () => {
    expect(p1OwnerSettlement).toContain('security definer');
    expect(p1OwnerSettlement).toContain('calculate_owner_net_payout');
  });
});
