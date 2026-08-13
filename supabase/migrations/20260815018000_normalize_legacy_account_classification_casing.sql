-- Normalize the live S03 uppercase account classification hotfix to the
-- canonical lowercase Stage 3 contract. This changes representation only:
-- account ids, numbers, names, balances, precision and activity are untouched.

do $reconcile$
begin
  if not exists (
    select 1 from public.accounts
    where account_type <> lower(account_type)
       or normal_balance <> lower(normal_balance)
  ) then
    return;
  end if;

  alter table public.accounts drop constraint if exists accounts_type_compat_chk;
  alter table public.accounts drop constraint if exists check_account_type;
  alter table public.accounts drop constraint if exists accounts_account_type_chk;
  alter table public.accounts drop constraint if exists accounts_normal_balance_chk;

  -- Remove the live-only uppercase compatibility trigger; otherwise it would
  -- rewrite canonical lowercase account_type values back to legacy uppercase
  -- on every insert/update.
  drop trigger if exists accounts_sync_contract on public.accounts;

  -- `type` is the superseded legacy classifier. The canonical contract uses
  -- account_type and no live object depends on the compatibility column.
  alter table public.accounts drop column if exists type;

  update public.accounts
  set account_type = lower(account_type),
      normal_balance = lower(normal_balance);

  alter table public.accounts
    add constraint accounts_account_type_chk
      check (account_type in ('asset','liability','equity','revenue','expense','other')),
    add constraint accounts_normal_balance_chk
      check (normal_balance in ('debit','credit'));
end;
$reconcile$;
