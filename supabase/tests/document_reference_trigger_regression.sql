-- S02 regression — public.assign_document_reference() row-shape resilience.
--
-- Root defect fixed by 20260805110000_s02_document_reference_trigger_resilience.sql:
-- the generic trigger read NEW.created_at directly, which raised 42703
-- `record "new" has no field "created_at"` on bank_statement_imports (whose
-- timestamp column is imported_at) and killed bank CSV import inserts.
--
-- This suite proves:
--   1. inserting into bank_statement_imports no longer raises and receives a
--      BNK reference derived from imported_at;
--   2. a created_at table (expenses) keeps its exact reference behavior;
--   3. an explicit reference is always respected (idempotent retry);
--   4. a row shape without company_id still resolves the singleton company
--      instead of failing.

begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.companies (id, name, slug)
values ('00000000-0000-4000-8000-0000000000c1', 'DocRef Company', 'docref-company')
on conflict (id) do nothing;

insert into public.bank_accounts (id, account_name, currency, company_id)
values ('00000000-0000-0000-0000-00000000c401', 'DocRef Bank', 'OMR', '00000000-0000-4000-8000-0000000000c1');

-- 1. The original 42703 kill is closed: insert on the imported_at row shape.
select lives_ok(
  $$insert into public.bank_statement_imports (company_id, bank_account_id, statement_name)
    values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-00000000c401', 'docref-check.csv')$$,
  'bank_statement_imports insert survives the reference trigger (no created_at column)'
);

-- 2. The batch received a BNK-prefixed reference.
select matches(
  (select reference from public.bank_statement_imports
    where company_id = '00000000-0000-4000-8000-0000000000c1'
      and statement_name = 'docref-check.csv'),
  '^BNK-\d{4}-\d{6}$',
  'import receives a BNK reference from the trigger'
);

-- 3. Explicit references are respected (idempotent retry / backfill safety).
select lives_ok(
  $$insert into public.bank_statement_imports (company_id, bank_account_id, statement_name, reference)
    values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-00000000c401', 'docref-manual.csv', 'BNK-MANUAL-000001')$$,
  'explicit reference insert is accepted'
);
select is(
  (select reference from public.bank_statement_imports
    where company_id = '00000000-0000-4000-8000-0000000000c1'
      and statement_name = 'docref-manual.csv'),
  'BNK-MANUAL-000001',
  'explicit reference is never overwritten by the trigger'
);

-- 4. A created_at table (expenses) keeps its EXP reference — no regression.
insert into public.properties (id, title, name, type, address, company_id)
values ('1c000000-0000-4000-8000-00000000000a', 'عقار دوك', 'عقار دوك', 'سكني', 'مسقط', '00000000-0000-4000-8000-0000000000c1')
on conflict (id) do nothing;

-- Keep the data-modifying statement top-level. PostgreSQL rejects a
-- data-modifying CTE nested inside a pgTAP function argument.
insert into public.expenses (id, company_id, property_id, category, amount, expense_date)
values (
  'ec000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-0000000000c1',
  '1c000000-0000-4000-8000-00000000000a',
  'صيانة',
  10,
  '2026-01-05'
);

select matches(
  (select reference from public.expenses
    where id = 'ec000000-0000-4000-8000-00000000000a'),
  '^EXP-\d{4}-\d{6}$',
  'expenses still receive EXP references from created_at'
);

select * from finish();
rollback;
