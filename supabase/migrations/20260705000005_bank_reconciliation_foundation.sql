-- Bank reconciliation foundation: bank accounts, statement imports/lines,
-- and one-to-one matches against recorded financial entities.

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  account_code text,
  currency text not null default 'OMR',
  opening_balance numeric(14,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bank_accounts_currency_chk check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts(id),
  statement_name text not null,
  statement_from date,
  statement_to date,
  imported_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  deleted_at timestamptz,
  constraint bank_statement_imports_period_chk check (statement_from is null or statement_to is null or statement_to >= statement_from)
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.bank_statement_imports(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id),
  transaction_date date not null,
  description text not null default '',
  reference text,
  amount numeric(14,2) not null,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bank_statement_lines_amount_nonzero_chk check (amount <> 0),
  constraint bank_statement_lines_status_chk check (status in ('unmatched', 'matched', 'ignored'))
);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  statement_line_id uuid not null unique references public.bank_statement_lines(id) on delete cascade,
  matched_entity_type text not null,
  matched_entity_id text not null,
  matched_amount numeric(14,2) not null,
  notes text,
  matched_at timestamptz not null default now(),
  matched_by uuid default auth.uid(),
  constraint bank_reconciliation_matches_type_chk check (matched_entity_type in ('payment', 'receipt', 'expense', 'manual_adjustment')),
  constraint bank_reconciliation_matches_amount_nonzero_chk check (matched_amount <> 0)
);

create index if not exists idx_bank_accounts_active on public.bank_accounts (is_active) where deleted_at is null;
create index if not exists idx_bank_statement_imports_account on public.bank_statement_imports (bank_account_id, imported_at desc) where deleted_at is null;
create index if not exists idx_bank_statement_lines_account_date on public.bank_statement_lines (bank_account_id, transaction_date desc) where deleted_at is null;
create index if not exists idx_bank_statement_lines_status on public.bank_statement_lines (status) where deleted_at is null;
create index if not exists idx_bank_reconciliation_matches_entity on public.bank_reconciliation_matches (matched_entity_type, matched_entity_id);

alter table public.bank_accounts enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliation_matches enable row level security;

drop policy if exists app_user_bank_accounts on public.bank_accounts;
drop policy if exists app_user_bank_statement_imports on public.bank_statement_imports;
drop policy if exists app_user_bank_statement_lines on public.bank_statement_lines;
drop policy if exists app_user_bank_reconciliation_matches on public.bank_reconciliation_matches;

create policy app_user_bank_accounts on public.bank_accounts
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());
create policy app_user_bank_statement_imports on public.bank_statement_imports
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());
create policy app_user_bank_statement_lines on public.bank_statement_lines
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());
create policy app_user_bank_reconciliation_matches on public.bank_reconciliation_matches
  for all to authenticated
  using (app_private.is_app_user())
  with check (app_private.is_app_user());

grant select, insert, update on public.bank_accounts to authenticated;
grant select, insert, update on public.bank_statement_imports to authenticated;
grant select, insert, update on public.bank_statement_lines to authenticated;
grant select, insert, update on public.bank_reconciliation_matches to authenticated;
revoke delete on public.bank_accounts from authenticated;
revoke delete on public.bank_statement_imports from authenticated;
revoke delete on public.bank_statement_lines from authenticated;
revoke delete on public.bank_reconciliation_matches from authenticated;
