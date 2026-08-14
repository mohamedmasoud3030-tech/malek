-- Manual rollback for WP-02 / GAP-009.
-- Financial-history rule: once a governed application/refund source event exists,
-- rollback is blocked. Never erase posted economic history to downgrade schema.

begin;

do $block$
begin
  if to_regclass('public.deposit_application_claims') is not null
     and exists (select 1 from public.deposit_application_claims) then
    raise exception 'ROLLBACK_BLOCKED_FINANCIAL_HISTORY: deposit application claims exist.' using errcode='55000';
  end if;
  if to_regclass('public.deposit_refund_events') is not null
     and exists (select 1 from public.deposit_refund_events) then
    raise exception 'ROLLBACK_BLOCKED_FINANCIAL_HISTORY: governed deposit refund events exist.' using errcode='55000';
  end if;
end;
$block$;

revoke all on function public.reverse_deposit_refund_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.refund_deposit_governed_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.reverse_deposit_claim_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.apply_deposit_claim_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.approve_deposit_application_claim_atomic(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.create_deposit_application_claim_atomic(jsonb) from public, anon, authenticated, service_role;

drop function if exists public.reverse_deposit_refund_atomic(jsonb);
drop function if exists public.refund_deposit_governed_atomic(jsonb);
drop function if exists public.reverse_deposit_claim_atomic(jsonb);
drop function if exists public.apply_deposit_claim_atomic(jsonb);
drop function if exists public.approve_deposit_application_claim_atomic(jsonb);
drop function if exists public.create_deposit_application_claim_atomic(jsonb);

drop table if exists public.deposit_refund_events;
drop table if exists public.deposit_application_claims;

-- Restore only the pre-GAP-009 function privileges. This rollback is permitted
-- only while the new ledgers are empty, so it cannot make new semantics diverge
-- from already-posted governed history.
grant execute on function public.gl_pm_post_deposit_application(jsonb) to service_role;
grant execute on function public.gl_pm_post_deposit_refund(jsonb) to service_role;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;
grant execute on function public.refund_deposit_atomic(jsonb) to authenticated, service_role;

-- Restore the legacy transaction check domain; no GAP-009 rows can exist here.
alter table public.deposit_transactions drop constraint if exists deposit_transactions_type_gap009_chk;
alter table public.deposit_transactions drop constraint if exists deposit_transactions_reason_gap009_chk;
alter table public.deposit_transactions
  add constraint deposit_transactions_type_check check (type in ('held','deduction','refund')),
  add constraint deposit_transactions_reason_check check (reason is null or reason in (
    'maintenance_damage','unpaid_arrears','cleaning_fee','other','initial_deposit','refund_full','refund_partial'
  ));

-- Precision widening is intentionally NOT reversed: narrowing numeric(18,3)
-- back to 2dp could destroy baisa-level information and is therefore unsafe.

commit;
