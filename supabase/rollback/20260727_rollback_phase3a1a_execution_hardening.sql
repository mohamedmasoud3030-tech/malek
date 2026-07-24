-- Roll back only the Phase 3A-1A execution-hardening wrappers.
-- Restores the functions produced by 20260727091000 without deleting financial data.
begin;

drop function if exists public.create_expense_with_journal_atomic(jsonb);
drop function if exists public.update_expense_with_journal_atomic(jsonb);
drop function if exists public.deduct_deposit_atomic(jsonb);
drop function if exists public.refund_deposit_atomic(jsonb);

alter function public.create_expense_with_journal_atomic_phase3a1a_impl(jsonb)
  rename to create_expense_with_journal_atomic;
alter function public.update_expense_with_journal_atomic_phase3a1a_impl(jsonb)
  rename to update_expense_with_journal_atomic;
alter function public.deduct_deposit_atomic_phase3a1a_impl(jsonb)
  rename to deduct_deposit_atomic;
alter function public.refund_deposit_atomic_phase3a1a_impl(jsonb)
  rename to refund_deposit_atomic;

revoke all on function public.create_expense_with_journal_atomic(jsonb) from public, anon;
revoke all on function public.update_expense_with_journal_atomic(jsonb) from public, anon;
revoke all on function public.deduct_deposit_atomic(jsonb) from public, anon;
revoke all on function public.refund_deposit_atomic(jsonb) from public, anon;

grant execute on function public.create_expense_with_journal_atomic(jsonb) to authenticated, service_role;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;
grant execute on function public.deduct_deposit_atomic(jsonb) to authenticated, service_role;
grant execute on function public.refund_deposit_atomic(jsonb) to authenticated, service_role;

commit;
