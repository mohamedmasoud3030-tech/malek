-- WP-02 / GAP-009 prerequisite: make the historical deposit subledger capable
-- of representing authoritative OMR 3dp and append-only reversal events.
-- numeric(14,2) -> numeric(18,3) is a widening conversion: no posted value loses precision.

begin;

alter table public.tenant_deposits
  alter column deposit_amount type numeric(18,3) using deposit_amount::numeric(18,3),
  alter column deducted_amount type numeric(18,3) using deducted_amount::numeric(18,3),
  alter column refunded_amount type numeric(18,3) using refunded_amount::numeric(18,3),
  alter column remaining_amount type numeric(18,3) using remaining_amount::numeric(18,3);

alter table public.deposit_transactions
  alter column amount type numeric(18,3) using amount::numeric(18,3);

-- Replace only the legacy domain checks that constrain transaction type/reason.
do $block$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.deposit_transactions'::regclass
      and contype = 'c'
      and (
        pg_get_constraintdef(oid) ilike '%type%held%deduction%refund%'
        or pg_get_constraintdef(oid) ilike '%reason%maintenance_damage%unpaid_arrears%'
      )
  loop
    execute format('alter table public.deposit_transactions drop constraint %I', r.conname);
  end loop;
end;
$block$;

alter table public.deposit_transactions
  add constraint deposit_transactions_type_gap009_chk
    check (type in ('held','deduction','refund','reversal')),
  add constraint deposit_transactions_reason_gap009_chk
    check (reason is null or reason in (
      'maintenance_damage','unpaid_arrears','cleaning_fee','other',
      'initial_deposit','refund_full','refund_partial','claim_reversal','refund_reversal'
    ));

comment on constraint deposit_transactions_type_gap009_chk on public.deposit_transactions is
  'GAP-009 permits only economic deposit events plus explicit compensating reversal; original rows remain append-only.';

commit;
