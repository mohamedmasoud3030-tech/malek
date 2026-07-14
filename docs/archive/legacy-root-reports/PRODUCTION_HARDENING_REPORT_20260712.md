# Rentrix Production Hardening Report

Date: 2026-07-12  
Repo HEAD verified: `cfb08bbe`  
Production project ref verified from repo docs: `nnggcnpcuomwfuupupwg`

> Status: **prepared, verified, not applied to Production**. Per approval response, no `supabase db push` or persistent production mutation was executed.

## 1. Confirmed issues

### Issue 1 — stale `soft_delete_contract_atomic(uuid)` overload

Confirmed live on Production:

| function | args | security definer | owner | execute grantees |
|---|---|---:|---|---|
| `public.soft_delete_contract_atomic` | `p_contract_id text` | true | postgres | authenticated, postgres, service_role |
| `public.soft_delete_contract_atomic` | `p_contract_id uuid` | true | postgres | authenticated, postgres, service_role |

Local migration history review:

- `20260712000000_contract_lifecycle_hardening.sql` creates `public.soft_delete_contract_atomic(uuid)` and grants it.
- `20260712010000_soft_delete_contract_atomic.sql` creates `public.soft_delete_contract_atomic(text)` and grants it.
- Frontend uses `supabase.rpc('soft_delete_contract_atomic', { p_contract_id: contractId })` from `rentrix-app/src/features/contracts/services/contractService.ts`.
- No frontend change is required.

### Issue 2 — QA seed data in Production

Confirmed live QA graph, not only the three originally reported rows. The rows carry deterministic QA IDs and/or clear QA marker text (`TEST-QA`, `بيانات اختبار جاهزية`).

| table | count | evidence |
|---|---:|---|
| `owners` | 1 | owner id `00000000-0000-4000-9000-000000000001`, name/notes contain QA markers |
| `properties` | 1 | property id `TEST-QA-PROP-001`, owner is QA owner |
| `units` | 1 | unit id `00000000-0000-4000-9001-000000000001`, property is QA property |
| `owner_agreements` | 1 | agreement id `00000000-0000-4000-9002-000000000001`, owner/property are QA |
| `people` | 1 | tenant id `00000000-0000-4000-9003-000000000001`, QA name/notes |
| `tenants` | 1 | legacy/shadow tenant id `00000000-0000-4000-9003-000000000001`, QA name/notes |
| `contracts` | 1 | contract id `b81853ee-b305-43f8-a7bc-39aed420781a`, linked only to QA property/unit/tenant/agreement |
| `invoices` | 1 | invoice id `00000000-0000-4000-9004-000000000001`, no `TEST-INV-1`, `UNPAID`, `paid_amount = 0`, QA notes |
| `payments` | 1 | payment ref/reference number `TEST-QA-REF-1`, invoice id is QA invoice |
| `receipts` | 1 | receipt ref `TEST-QA-REF-1`, status `VOID`, contract is QA contract |
| `financial_operation_idempotency` | 1 | request id `test-qa-payment-001`, payload references QA invoice/payment/receipt |
| `owner_balances` | 1 | QA owner, all financial values zero |
| `tenant_balances` | 1 | QA tenant, balance due `150` |
| `contract_balances` | 1 | QA contract/unit/tenant, total invoiced `150`, paid `0`, balance due `150` |

FK/relationship checks performed:

- `invoices.contract_id -> contracts(id)`.
- `payments.contract_id -> contracts(id)`; `payments.invoice_id` is not enforced by FK in live schema.
- `receipt_allocations.invoice_id -> invoices(id)` and `receipt_allocations.receipt_id -> receipts(id)`.
- `contracts.agreement_id -> owner_agreements(id) ON DELETE RESTRICT`.
- `contracts.tenant_id -> people(id) ON DELETE RESTRICT`.
- `contracts.unit_id -> units(id)`.
- `contracts.property_id -> properties(id) ON DELETE SET NULL`.
- `tenant_balances.tenant_id -> people(id) ON DELETE RESTRICT`.
- `contract_balances.contract_id -> contracts(id)` has RESTRICT constraints live.

Additional inbound safety checks all returned zero:

| check | count |
|---|---:|
| `receipt_allocations` for QA invoice | 0 |
| `receipt_allocations` for QA receipt | 0 |
| `deposit_txs` for QA contract | 0 |
| `contract_documents` for QA contract | 0 |
| `maintenance_records` for QA unit | 0 |
| `cost_centers` for QA property | 0 |
| `property_owners` for QA owner/property | 0 |
| contracts renewed from QA contract | 0 |

### Issue 3 — migration state mismatch

Confirmed live migration ledger mismatch:

- Remote `supabase_migrations.schema_migrations`: **54** versions.
- Local `supabase/migrations/*.sql` before new files: **67** versions.
- Remote versions missing locally: **0**.
- Local versions missing remotely before new files: **13**.
- Local filenames are timestamp-sorted and no duplicate local versions were found.

Existing local-not-remote migrations before this task:

1. `20260713000002_fix_owner_balances_cascade.sql`
2. `20260713000003_fix_receipt_allocations_cascade.sql`
3. `20260713000004_fix_expense_rpc_role_check.sql`
4. `20260713000005_fix_void_receipt_anon_grant.sql`
5. `20260713000006_fix_report_rpcs_security_definer.sql`
6. `20260713000007_add_update_expense_with_journal_atomic.sql`
7. `20260713000008_add_journal_batch_balance_check.sql`
8. `20260714000001_seed_revenue_account.sql`
9. `20260714000002_hardened_invoice_generation.sql`
10. `20260714000003_contract_balances_triggers.sql`
11. `20260714000004_fix_rpt_cash_flow_void_filter.sql`
12. `20260714000005_fix_rpt_vat_return_void_filter.sql`
13. `20260714000006_fix_rpt_financial_summary_status.sql`

After this task, local-not-remote becomes **15** by adding the two new files listed below.

## 2. Files modified

Created only new migration files:

1. `supabase/migrations/20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql`
2. `supabase/migrations/20260715000002_purge_production_qa_seed_data.sql`

No frontend files were modified. No business logic was changed.

## 3. New migrations

### `20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql`

Purpose: remove only the stale uuid overload.

```sql
DROP FUNCTION IF EXISTS public.soft_delete_contract_atomic(uuid);
```

Safety:

- Idempotent.
- Does not touch `public.soft_delete_contract_atomic(text)`.
- Does not change grants/owner/body of the correct text overload.

### `20260715000002_purge_production_qa_seed_data.sql`

Purpose: remove only deterministic QA seed graph discovered in Production.

Main deletion targets:

- `financial_operation_idempotency` request `test-qa-payment-001` / payload references to QA invoice/reference.
- `payments` with invoice `00000000-0000-4000-9004-000000000001` or reference `TEST-QA-REF-1`.
- `receipts` with ref `TEST-QA-REF-1` / request `test-qa-payment-001`.
- `invoices` id `00000000-0000-4000-9004-000000000001` / QA invoice row.
- `contract_balances`, `tenant_balances`, `owner_balances` for QA IDs.
- QA contract, tenant/person, owner agreement, unit, property, owner.

Safety:

- No `TRUNCATE`.
- Guarded `DO $$ ... $$` block raises if deterministic IDs exist without expected QA markers/relationships.
- Deletes children before parents to satisfy FKs.
- Idempotent: re-running after cleanup is a no-op.

## 4. Diff summary

```diff
+++ supabase/migrations/20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql
+DROP FUNCTION IF EXISTS public.soft_delete_contract_atomic(uuid);

+++ supabase/migrations/20260715000002_purge_production_qa_seed_data.sql
+DO $$
+DECLARE
+  v_qa_owner_id    text := '00000000-0000-4000-9000-000000000001';
+  v_qa_unit_id     text := '00000000-0000-4000-9001-000000000001';
+  v_qa_agreement_id uuid := '00000000-0000-4000-9002-000000000001'::uuid;
+  v_qa_tenant_id   text := '00000000-0000-4000-9003-000000000001';
+  v_qa_invoice_id  text := '00000000-0000-4000-9004-000000000001';
+  v_qa_property_id text := 'TEST-QA-PROP-001';
+  v_qa_reference   text := 'TEST-QA-REF-1';
+  ... guarded QA-only deletes ...
+END $$;
```

Full diff is available in the two migration files.

## 5. Verification results

### Pre-apply verification

- `soft_delete_contract_atomic(text)` and `soft_delete_contract_atomic(uuid)` both exist live.
- Correct text overload remains `SECURITY DEFINER`, owner `postgres`, executable by `authenticated` and `service_role`.
- QA seed graph is deterministic and marked as QA/test data.
- No unexpected inbound real-data relationships were found for the QA invoice/receipt/contract/unit/property.
- Contract RPCs present live:
  - `create_contract_atomic(...)` — `SECURITY DEFINER`
  - `update_contract_atomic(...)` — `SECURITY DEFINER`
  - `renew_contract_atomic(old_contract_id text, new_contract_data jsonb)` — `SECURITY DEFINER`
  - `terminate_contract_atomic(p_contract_id text, p_reason text)` — `SECURITY DEFINER`
  - `soft_delete_contract_atomic(p_contract_id text)` — `SECURITY DEFINER`
  - stale `soft_delete_contract_atomic(p_contract_id uuid)` still present until migration is applied.

### Dry-run verification

Executed both new migration files inside a rollback-only transaction on Production:

```sql
BEGIN;
-- migration 20260715000001
-- migration 20260715000002
ROLLBACK;
```

Result: `HTTP_STATUS:201`, empty result set, no SQL errors. This verified syntax and pre-flight guards without persisting changes.

### Post-apply verification queries to run after approved deployment

```sql
-- Must return only p_contract_id text
select pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'soft_delete_contract_atomic'
order by args;

-- Must return zero rows
create temp table qa_scan_results(table_name text, row_count bigint) on commit drop;
do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      $f$insert into qa_scan_results(table_name, row_count)
         select %L, count(*) from %I.%I t
         where to_jsonb(t)::text ilike '%%TEST-QA%%'
            or to_jsonb(t)::text like '%%اختبار جاهزية%%'
            or to_jsonb(t)::text like '%%00000000-0000-4000-900%%'$f$,
      r.tablename, r.schemaname, r.tablename
    );
  end loop;
end $$;
select * from qa_scan_results where row_count > 0 order by table_name;

-- Contract RPC existence/security check
select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname in (
    'create_contract_atomic','update_contract_atomic','renew_contract_atomic',
    'terminate_contract_atomic','soft_delete_contract_atomic'
  )
order by p.proname, args;
```

## 6. Remaining risks / blockers

1. **Not applied yet.** Per explicit approval response, no `supabase db push` was executed and no persistent production mutation was made.
2. **`supabase db push` will not apply only the two new migrations.** It will apply all local-not-remote migrations in timestamp order. Current pending set is 15 migrations: the 13 existing backlog migrations plus the two new hardening migrations.
3. Because the two new migrations are timestamped after the existing pending migrations (`20260715...`), a normal `supabase db push` will apply the 13 older pending migrations first.
4. Final proof requirements are therefore still pending until approved deployment:
   - stale `soft_delete_contract_atomic(uuid)` absent,
   - QA seed data absent,
   - migration state synchronized,
   - Contract RPCs still working/present,
   - financial integrity unchanged except removal of QA-only rows.

## Recommended next step

Before Production deployment, decide between:

1. Approve `supabase db push` for all 15 pending migrations and then run the post-apply verification queries above.
2. Create a controlled release branch/folder strategy so only reviewed migrations are present for `db push`.
3. Use a targeted DBA-run migration path with explicit ledger handling, if the team rejects applying the 13 existing pending migrations now.
