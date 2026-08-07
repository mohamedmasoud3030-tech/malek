-- S02-T06 — close browser-direct writes to payments and expenses.
begin;

do $$
declare
  v_missing text;
begin
  select string_agg(required.signature, ', ' order by required.signature)
    into v_missing
  from (values
    ('public.record_invoice_payment_atomic(jsonb)'),
    ('public.void_receipt_atomic(jsonb)'),
    ('public.create_expense_with_journal_atomic(jsonb)'),
    ('public.update_expense_with_journal_atomic(jsonb)')
  ) as required(signature)
  where to_regprocedure(required.signature) is null
     or not (select p.prosecdef from pg_proc p where p.oid = to_regprocedure(required.signature));

  if v_missing is not null then
    raise exception 'S02-T06 aborted: missing or non-SECURITY-DEFINER RPC(s): %', v_missing;
  end if;
end $$;

-- Lock function execution to authenticated/service_role only.
revoke all on function public.record_invoice_payment_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.void_receipt_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.create_expense_with_journal_atomic(jsonb) from public, anon, authenticated;
revoke all on function public.update_expense_with_journal_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.record_invoice_payment_atomic(jsonb) to authenticated, service_role;
grant execute on function public.void_receipt_atomic(jsonb) to authenticated, service_role;
grant execute on function public.create_expense_with_journal_atomic(jsonb) to authenticated, service_role;
grant execute on function public.update_expense_with_journal_atomic(jsonb) to authenticated, service_role;

-- Replace legacy write-capable policies with company-scoped SELECT policies.
drop policy if exists app_user_payments on public.payments;
drop policy if exists app_read_payments on public.payments;
drop policy if exists manager_write_payments on public.payments;
drop policy if exists payments_select_app_users on public.payments;

alter table public.payments enable row level security;
create policy payments_select_app_users
  on public.payments
  for select
  to authenticated
  using (
    public.is_app_user()
    and company_id = public.current_company_id()
  );

revoke insert, update, delete on table public.payments from authenticated;
revoke all on table public.payments from anon, public;
grant select on table public.payments to authenticated;

drop policy if exists app_user_expenses on public.expenses;
drop policy if exists app_read_expenses on public.expenses;
drop policy if exists manager_write_expenses on public.expenses;
drop policy if exists expenses_select_app_users on public.expenses;

alter table public.expenses enable row level security;
create policy expenses_select_app_users
  on public.expenses
  for select
  to authenticated
  using (
    public.is_app_user()
    and company_id = public.current_company_id()
  );

revoke insert, update, delete on table public.expenses from authenticated;
revoke all on table public.expenses from anon, public;
grant select on table public.expenses to authenticated;

comment on table public.payments is
  'S02-T06: authenticated clients have company-scoped SELECT only; mutations require approved SECURITY DEFINER RPCs.';
comment on table public.expenses is
  'S02-T06: authenticated clients have company-scoped SELECT only; mutations require approved SECURITY DEFINER RPCs.';

commit;
