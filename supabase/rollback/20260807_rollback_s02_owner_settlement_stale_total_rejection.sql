-- Manual rollback for 20260807163000_s02_owner_settlement_stale_total_rejection.sql — not auto-applied, run by hand only in an approved emergency/reversal procedure.
-- Restores the FA-003 public lifecycle function names and grants.

begin;

drop function if exists public.approve_owner_settlement_atomic(jsonb);
drop function if exists public.pay_owner_settlement_atomic(jsonb);
drop function if exists public.assert_owner_settlement_totals_fresh(text);

alter function public.approve_owner_settlement_atomic_s02_base(jsonb)
  rename to approve_owner_settlement_atomic;
alter function public.pay_owner_settlement_atomic_s02_base(jsonb)
  rename to pay_owner_settlement_atomic;

alter function public.approve_owner_settlement_atomic(jsonb) owner to postgres;
alter function public.pay_owner_settlement_atomic(jsonb) owner to postgres;

revoke all on function public.approve_owner_settlement_atomic(jsonb) from public, anon;
revoke all on function public.pay_owner_settlement_atomic(jsonb) from public, anon;
grant execute on function public.approve_owner_settlement_atomic(jsonb) to authenticated, service_role;
grant execute on function public.pay_owner_settlement_atomic(jsonb) to authenticated, service_role;

comment on function public.approve_owner_settlement_atomic(jsonb) is
  'FA-003: approval requires the settlement to be fully reserved by its derived items with no released link.';
comment on function public.pay_owner_settlement_atomic(jsonb) is
  'FA-003: payment requires full reservation, creates no new links, and leaves PAID links permanently unreleased.';

commit;