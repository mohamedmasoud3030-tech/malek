-- FOM-013 bank reconciliation coverage expansion
-- Expands matched_entity_type to cover every governed 1111/1120 movement:
-- tenant collections (payment/receipt), company expenses (expense),
-- owner expenses (owner_expense), owner payouts (owner_payout),
-- tenant deposit receipts (deposit_receipt), deposit refunds (deposit_refund),
-- broker commission payments (commission_payment), manual adjustments.

begin;

-- Drop old check constraint
alter table public.bank_reconciliation_matches
  drop constraint if exists bank_reconciliation_matches_type_chk;

-- Add expanded check constraint
alter table public.bank_reconciliation_matches
  add constraint bank_reconciliation_matches_type_chk
  check (
    matched_entity_type = any (array[
      'payment'::text,
      'receipt'::text,
      'expense'::text,
      'manual_adjustment'::text,
      'owner_payout'::text,
      'deposit_receipt'::text,
      'deposit_refund'::text,
      'commission_payment'::text,
      'owner_expense'::text
    ])
  );

-- Update comment to document expanded coverage
comment on constraint bank_reconciliation_matches_type_chk on public.bank_reconciliation_matches is
  'FOM-013 expanded: covers tenant collections, owner payouts, deposit receipts/refunds, commission payments, company/owner expenses, manual adjustments — every governed 1111/1120 movement';

commit;
