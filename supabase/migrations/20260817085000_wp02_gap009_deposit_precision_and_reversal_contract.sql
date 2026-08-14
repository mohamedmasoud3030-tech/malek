-- WP-02 / GAP-009 prerequisite: make the historical deposit subledger capable
-- of representing authoritative OMR 3dp and append-only reversal events.
-- numeric(14,2) -> numeric(18,3) is a widening conversion: no posted value loses precision.
--
-- Dependency-aware precision widening: the S08 frozen analysis views project
-- tenant_deposits.remaining_amount. PostgreSQL refuses to alter a column type
-- used by a view rule, so the views are captured verbatim (pg_get_viewdef),
-- dropped, the columns widened, and the views recreated in the SAME transaction
-- with the exact WP-05 semantics and security posture (security_invoker,
-- service_role-only grants). This is the same supersede pattern the WP-05
-- migration itself used when replacing the S08 views; nothing is dropped
-- blindly and no historical migration is edited.

begin;

do $preserve_s08_deposit_views$
declare
  v_liability_view text;
  v_reconciliation_view text;
begin
  if to_regclass('public.s08_liability_balances_by_period') is not null then
    select pg_get_viewdef('public.s08_liability_balances_by_period'::regclass, true)
      into v_liability_view;
  end if;
  if to_regclass('public.s08_subledger_gl_reconciliation') is not null then
    select pg_get_viewdef('public.s08_subledger_gl_reconciliation'::regclass, true)
      into v_reconciliation_view;
  end if;

  drop view if exists public.s08_liability_balances_by_period cascade;
  drop view if exists public.s08_subledger_gl_reconciliation cascade;

  alter table public.tenant_deposits
    alter column deposit_amount type numeric(18,3) using deposit_amount::numeric(18,3),
    alter column deducted_amount type numeric(18,3) using deducted_amount::numeric(18,3),
    alter column refunded_amount type numeric(18,3) using refunded_amount::numeric(18,3),
    alter column remaining_amount type numeric(18,3) using remaining_amount::numeric(18,3);

  alter table public.deposit_transactions
    alter column amount type numeric(18,3) using amount::numeric(18,3);

  if v_liability_view is not null then
    execute 'create view public.s08_liability_balances_by_period with (security_invoker = true) as ' || v_liability_view;
  end if;
  if v_reconciliation_view is not null then
    execute 'create view public.s08_subledger_gl_reconciliation with (security_invoker = true) as ' || v_reconciliation_view;
  end if;
end;
$preserve_s08_deposit_views$;

-- Recreate the S08 view grants exactly as WP-05 defined them.
revoke all on table public.s08_liability_balances_by_period from public, anon;
revoke all on table public.s08_subledger_gl_reconciliation from public, anon;
grant select on table public.s08_liability_balances_by_period to service_role;
grant select on table public.s08_subledger_gl_reconciliation to service_role;

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

-- Compensating-reversal linkage on the append-only transaction log.
alter table public.deposit_transactions
  add column if not exists reversal_of_id uuid references public.deposit_transactions(id) on delete restrict;

-- Append-only enforcement: deposit transactions are immutable evidence. Only
-- the governed RPCs insert; UPDATE/DELETE are always rejected.
create or replace function public.guard_deposit_transactions_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'DEPOSIT_TRANSACTION_IMMUTABLE: deposit transactions are append-only evidence'
      using errcode = '55000';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_deposit_transactions_immutable on public.deposit_transactions;
create trigger trg_deposit_transactions_immutable
  before update or delete on public.deposit_transactions
  for each row execute function public.guard_deposit_transactions_immutable();

comment on constraint deposit_transactions_type_gap009_chk on public.deposit_transactions is
  'GAP-009 permits only economic deposit events plus explicit compensating reversal; original rows remain append-only.';

commit;
