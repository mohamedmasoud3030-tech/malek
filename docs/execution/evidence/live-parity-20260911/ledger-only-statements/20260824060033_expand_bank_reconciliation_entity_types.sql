begin;
alter table public.bank_reconciliation_matches drop constraint if exists bank_reconciliation_matches_type_chk;
alter table public.bank_reconciliation_matches add constraint bank_reconciliation_matches_type_chk check (matched_entity_type = any (array['payment'::text,'receipt'::text,'expense'::text,'manual_adjustment'::text,'owner_payout'::text,'deposit_receipt'::text,'deposit_refund'::text,'commission_payment'::text,'owner_expense'::text]));
comment on constraint bank_reconciliation_matches_type_chk on public.bank_reconciliation_matches is 'FOM-013 expanded: covers tenant collections, owner payouts, deposit receipts/refunds, commission payments, company/owner expenses, manual adjustments — every governed 1111/1120 movement';
commit;