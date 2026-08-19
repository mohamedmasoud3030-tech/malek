\set ON_ERROR_STOP on

-- Canonical baseline verification. Any violation aborts the build.

do $canonical_verify$
declare
  v_bad integer;
  v_def text;
begin
  -- Required domain and accounting foundations.
  if to_regclass('public.companies') is null
     or to_regclass('public.company_members') is null
     or to_regclass('public.people') is null
     or to_regclass('public.tenant_profiles') is null
     or to_regclass('public.contracts') is null
     or to_regclass('public.invoices') is null
     or to_regclass('public.receipts') is null
     or to_regclass('public.payments') is null
     or to_regclass('public.tenant_deposits') is null
     or to_regclass('public.deposit_transactions') is null
     or to_regclass('public.owner_funds_events') is null
     or to_regclass('public.accounts') is null
     or to_regclass('public.accounting_periods') is null
     or to_regclass('public.journal_batches') is null
     or to_regclass('public.journal_lines') is null
     or to_regclass('public.payment_terms_templates') is null then
    raise exception 'CANONICAL_REQUIRED_RELATION_MISSING';
  end if;

  -- Canonical GL only: compatibility view may remain temporarily, but the old
  -- storage/archive table must not be part of a fresh bootstrap.
  if to_regclass('public.journal_entries_archive') is not null then
    raise exception 'CANONICAL_LEGACY_JOURNAL_ARCHIVE_PRESENT';
  end if;
  if to_regclass('public.journal_entries') is null then
    raise exception 'CANONICAL_JOURNAL_COMPAT_VIEW_MISSING';
  end if;
  if (select relkind from pg_class where oid='public.journal_entries'::regclass) <> 'v' then
    raise exception 'CANONICAL_JOURNAL_ENTRIES_NOT_VIEW';
  end if;

  -- Proven orphan/duplicate bootstrap objects must stay retired.
  select count(*) into v_bad
  from unnest(array[
    'tenants','deposit_txs','account_balances','schema_refactor_notes','sessions',
    'profiles','settings','snapshots','kpi_snapshots','missions','auto_backups','budgets'
  ]) as x(name)
  where to_regclass('public.' || x.name) is not null;
  if v_bad <> 0 then
    raise exception 'CANONICAL_RETIRED_RELATION_PRESENT: %', v_bad;
  end if;

  -- Product surfaces explicitly preserved by the domain decision record.
  if to_regclass('public.lands') is null
     or to_regclass('public.leads') is null
     or to_regclass('public.commissions') is null then
    raise exception 'CANONICAL_PRESERVED_DOMAIN_MISSING';
  end if;

  -- Every tenant profile is a tenant person in the same company.
  select count(*) into v_bad
  from public.tenant_profiles tp
  left join public.people p on p.id=tp.tenant_id
  where p.id is null or p.type <> 'tenant' or p.company_id is distinct from tp.company_id;
  if v_bad <> 0 then
    raise exception 'CANONICAL_TENANT_PROFILE_IDENTITY_FAILURE: %', v_bad;
  end if;

  -- Company settings must be one row per company, never one row globally.
  if exists (
    select 1 from pg_constraint
    where conrelid='public.company_settings'::regclass
      and conname='company_settings_singleton_key_key'
  ) then
    raise exception 'CANONICAL_GLOBAL_SETTINGS_SINGLETON_PRESENT';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.company_settings'::regclass
      and conname='company_settings_company_id_key'
      and convalidated
  ) then
    raise exception 'CANONICAL_COMPANY_SETTINGS_UNIQUE_MISSING';
  end if;

  -- Six roles must be physically valid and the constraint must be validated.
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.users'::regclass
      and conname='users_role_valid_chk'
      and convalidated
  ) then
    raise exception 'CANONICAL_ROLE_CONSTRAINT_NOT_VALIDATED';
  end if;

  -- Contract status must have exactly the canonical lowercase vocabulary.
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid='public.contracts'::regclass
    and conname='contracts_status_check';
  if v_def is null
     or v_def not like '%draft%'
     or v_def not like '%active%'
     or v_def not like '%expired%'
     or v_def not like '%terminated%'
     or v_def like '%ENDED%'
     or v_def like '%ACTIVE%'
  then
    raise exception 'CANONICAL_CONTRACT_STATUS_CONSTRAINT_INVALID: %', v_def;
  end if;

  if exists (
    select 1 from public.contracts
    where status not in ('draft','active','expired','terminated')
  ) then
    raise exception 'CANONICAL_CONTRACT_STATUS_DATA_INVALID';
  end if;

  -- OMR authoritative surfaces are three-decimal native storage.
  select count(*) into v_bad
  from information_schema.columns
  where table_schema='public'
    and (
      (table_name='contracts' and column_name='rent_amount')
      or (table_name='invoices' and column_name in ('amount','paid_amount','tax_amount'))
      or (table_name='payments' and column_name='amount')
      or (table_name='receipts' and column_name='amount')
      or (table_name='receipt_allocations' and column_name='amount')
      or (table_name='expenses' and column_name='amount')
      or (table_name='journal_lines' and column_name in ('debit','credit'))
      or (table_name='tenant_deposits' and column_name in ('deposit_amount','deducted_amount','refunded_amount','remaining_amount'))
    )
    and not (numeric_precision=18 and numeric_scale=3);
  if v_bad <> 0 then
    raise exception 'CANONICAL_OMR_PRECISION_FAILURE: %', v_bad;
  end if;

  -- Critical read/write contracts must exist with the signatures actually used
  -- by the current app/live Demo contract.
  if to_regprocedure('public.rpt_dashboard_snapshot(date,date,date)') is null
     or to_regprocedure('public.post_journal_event(jsonb)') is null
     or to_regprocedure('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text,integer,integer)') is null then
    raise exception 'CANONICAL_CRITICAL_RPC_MISSING';
  end if;

  -- RLS is mandatory on application-owned public tables. Explicit exception:
  -- views are not tables and are handled through security_invoker/grants.
  select count(*) into v_bad
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind in ('r','p')
    and not c.relrowsecurity;
  if v_bad <> 0 then
    raise exception 'CANONICAL_RLS_DISABLED_TABLES: %', v_bad;
  end if;
end
$canonical_verify$;

-- Posted GL batches must be balanced. Empty fresh databases trivially satisfy
-- this; seeded/integration verification exercises non-empty postings later.
do $gl_verify$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from (
    select b.id
    from public.journal_batches b
    join public.journal_lines l on l.batch_id=b.id and l.deleted_at is null
    where upper(coalesce(b.status,''))='POSTED'
    group by b.id
    having round(coalesce(sum(l.debit),0),3) <> round(coalesce(sum(l.credit),0),3)
  ) q;
  if v_bad <> 0 then
    raise exception 'CANONICAL_UNBALANCED_POSTED_BATCHES: %', v_bad;
  end if;
end
$gl_verify$;
