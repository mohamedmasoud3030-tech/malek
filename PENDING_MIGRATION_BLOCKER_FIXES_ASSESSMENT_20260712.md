# Pending Migration Blocker Fixes Assessment

Date: 2026-07-12  
Scope: Fix three blockers in pending migrations only.  
Deployment: **No `supabase db push` executed.**

## Files modified

1. `supabase/migrations/20260713000002_fix_owner_balances_cascade.sql`
2. `supabase/migrations/20260713000007_add_update_expense_with_journal_atomic.sql`
3. `supabase/migrations/20260714000003_contract_balances_triggers.sql`

---

## 1. `20260713000002_fix_owner_balances_cascade.sql`

### Original blocker

Production schema:

- `public.owner_balances.owner_id` = `text`
- `public.owners.id` = `uuid`

Original migration tried to:

```sql
LEFT JOIN public.owners o ON o.id = ob.owner_id
...
FOREIGN KEY (owner_id) REFERENCES public.owners(id)
```

This is invalid in PostgreSQL (`uuid = text` and text FK to uuid PK).

### Final chosen approach

I did **not** introduce a foreign key.

Instead, the migration now implements equivalent hard-delete protection with a trigger:

- Preflight checks orphan rows using explicit cast:
  ```sql
  LEFT JOIN public.owners o ON o.id::text = ob.owner_id
  ```
- Drops any same-named invalid/legacy FK if present.
- Creates `public.prevent_owner_delete_with_balances()`.
- Creates `BEFORE DELETE` trigger on `public.owners`:
  ```sql
  OLD.id::text = owner_balances.owner_id
  ```
- Raises SQLSTATE `23503` if an owner with existing balance rows is hard-deleted.

This preserves financial data and mimics `ON DELETE RESTRICT` semantics without creating an invalid FK across mismatched types.

### Impact

| Item | Impact |
|---|---|
| Business data mutation | None |
| `owner_balances` | Reads only in preflight and trigger check |
| `owners` | Adds hard-delete guard trigger |
| Normal soft-delete/archive flow | Unchanged |
| Hard-delete owner with balance | Now blocked |

### Risk after fix

**LOW/MEDIUM**

Low for normal app usage because the application uses soft-delete. Medium only because a new trigger changes direct hard-delete behavior, intentionally protecting financial history.

---

## 2. `20260713000007_add_update_expense_with_journal_atomic.sql`

### Original blocker

Production schema:

- `public.expenses.id` = `text`

Original RPC used:

```sql
v_expense_id uuid := nullif(p_payload->>'expense_id', '')::uuid;
...
WHERE id = v_expense_id
```

This creates invalid runtime comparisons: `text = uuid`.

### Fix applied

- Changed `v_expense_id` to `text`.
- Removed unnecessary `::text` casts around `v_expense_id` string operations.
- Ensured journal/audit inserted IDs are explicitly text:
  ```sql
  gen_random_uuid()::text
  ```
- Journal linkage remains text-compatible:
  - `journal_entries.source_id` receives `v_expense_id` text.
  - `journal_entries.entity_id` receives `v_expense_id` text.
  - `audit_log.entity_id` receives `v_expense_id` text.

### Related ID verification

For this migration/RPC:

| ID | Production type | RPC handling after fix |
|---|---|---|
| `expense_id` | `text` | `text` variable; text comparisons |
| `contract_id` | `text` in `expenses` | Not read/modified by this update RPC |
| `property_id` | `text` in `expenses` | Not read/modified by this update RPC |
| `cost_center_id` | `text` in `expenses` | Not read/modified by this update RPC |

The RPC preserves journal atomicity and idempotency: row lock + advisory lock + expense update + reversal/new journal entries + audit log + idempotency insert remain unchanged.

### Impact

| Item | Impact |
|---|---|
| Business data mutation | Runtime only when RPC is called |
| `expenses` | Updates selected expense row |
| `journal_entries` | Inserts reversal/new entries when amount changes |
| `financial_operation_idempotency` | Inserts idempotency result |
| `audit_log` | Inserts update audit row |

### Risk after fix

**MEDIUM**

The schema blocker is removed. Risk remains medium because this is a new write RPC that mutates expenses and journal entries at runtime.

---

## 3. `20260714000003_contract_balances_triggers.sql`

### Original blocker

Production schema uses text IDs:

- `public.contracts.id` = `text`
- `public.invoices.contract_id` = `text`
- `public.contract_balances.contract_id` = `text`
- `public.contract_balances.tenant_id` = `text`
- `public.contract_balances.unit_id` = `text`

Original trigger functions used:

```sql
v_contract_id uuid;
v_tenant_id uuid;
v_unit_id uuid;
```

and then compared:

```sql
WHERE c.id = v_contract_id
```

This can fail as `text = uuid` during invoice/allocation writes.

### Fix applied

- Changed trigger-local IDs to text:
  ```sql
  v_contract_id text;
  v_tenant_id text;
  v_unit_id text;
  ```
- Cast `contracts.unit_id` to text when writing into `contract_balances.unit_id`:
  ```sql
  c.unit_id::text
  ```
- Added null guard for invoice rows with no contract:
  ```sql
  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  ```
- Added defensive `IF NOT FOUND` guard after contract lookup to avoid failing invoice/allocation writes if a referenced contract is unexpectedly absent.
- Preserved existing balance formulas:
  ```sql
  total_invoiced = SUM(invoice.amount + tax_amount)
  total_paid = SUM(invoice.paid_amount)
  balance_due = total_invoiced - total_paid
  ```

### Impact

| Item | Impact |
|---|---|
| Immediate data mutation | Backfills/upserts `contract_balances` |
| Runtime mutation | Triggers upsert `contract_balances` on invoice/allocation changes |
| `invoices` | Trigger attached to INSERT/UPDATE/DELETE |
| `receipt_allocations` | Trigger attached to INSERT/DELETE |
| `contract_balances` | Maintained by backfill and triggers |

### Risk after fix

**MEDIUM/HIGH**

The type blocker is removed. Risk remains elevated because this migration adds triggers to high-volume financial paths (`invoices`, `receipt_allocations`) and backfills `contract_balances`.

---

## Diff summary

```diff
20260713000002_fix_owner_balances_cascade.sql
- LEFT JOIN public.owners o ON o.id = ob.owner_id
- ADD CONSTRAINT owner_balances_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE RESTRICT
+ LEFT JOIN public.owners o ON o.id::text = ob.owner_id
+ CREATE FUNCTION prevent_owner_delete_with_balances()
+ CREATE TRIGGER trg_prevent_owner_delete_with_balances BEFORE DELETE ON owners
+ no invalid owner_balances -> owners FK is created

20260713000007_add_update_expense_with_journal_atomic.sql
- v_expense_id uuid := nullif(..., '')::uuid;
+ v_expense_id text := nullif(..., '');
- WHERE id = v_expense_id -- text = uuid at runtime
+ WHERE id = v_expense_id -- text = text
+ gen_random_uuid()::text for text ID columns

20260714000003_contract_balances_triggers.sql
- v_contract_id uuid;
- v_tenant_id uuid;
- v_unit_id uuid;
+ v_contract_id text;
+ v_tenant_id text;
+ v_unit_id text;
+ c.unit_id::text
+ NULL contract guard
+ NOT FOUND defensive guard
```

Full diff can be generated with:

```bash
git diff -- \
  supabase/migrations/20260713000002_fix_owner_balances_cascade.sql \
  supabase/migrations/20260713000007_add_update_expense_with_journal_atomic.sql \
  supabase/migrations/20260714000003_contract_balances_triggers.sql
```

---

## Updated impact assessment for the 3 fixed migrations

| Migration | INSERT | UPDATE | DELETE | DROP | ALTER TABLE | Function/RPC | RLS/Permissions | Affected key tables | Risk |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| `20260713000002` | No | No | No DML | Drops same-named FK if exists; drops trigger if re-run | Yes, only `DROP CONSTRAINT IF EXISTS` | Trigger function | Function grants/revokes | `owners`, `owner_balances` | LOW/MEDIUM |
| `20260713000007` | Runtime | Runtime | No | No effective DROP; comment only | No | New RPC | Function grants/revokes | `expenses`, `journal_entries`, `audit_log`, idempotency | MEDIUM |
| `20260714000003` | Immediate backfill + runtime upsert | Runtime via `ON CONFLICT DO UPDATE` | No DML | Drops/recreates triggers | No | Trigger functions | Function grants/revokes | `invoices`, `receipt_allocations`, `contract_balances` | MEDIUM/HIGH |

---

## Verification SQL to run before approval / after any dry-run

### Type compatibility checks

```sql
select table_name, column_name, data_type, udt_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'owner_balances' and column_name = 'owner_id') or
    (table_name = 'owners' and column_name = 'id') or
    (table_name = 'expenses' and column_name in ('id','property_id','contract_id','cost_center_id')) or
    (table_name = 'contracts' and column_name in ('id','tenant_id','unit_id')) or
    (table_name = 'invoices' and column_name in ('id','contract_id')) or
    (table_name = 'contract_balances' and column_name in ('contract_id','tenant_id','unit_id')) or
    (table_name = 'receipt_allocations' and column_name in ('invoice_id','receipt_id'))
  )
order by table_name, column_name;
```

### Preflight data checks

```sql
select 'owner_balance_orphans' as check_name, count(*) as count
from public.owner_balances ob
left join public.owners o on o.id::text = ob.owner_id
where o.id is null
union all
select 'receipt_allocation_receipt_orphans', count(*)
from public.receipt_allocations ra
left join public.receipts r on r.id = ra.receipt_id
where r.id is null
union all
select 'contract_balances_orphans', count(*)
from public.contract_balances cb
left join public.contracts c on c.id = cb.contract_id
where c.id is null
union all
select 'invoice_contract_issue_date_duplicates', count(*)
from (
  select contract_id, issue_date, count(*)
  from public.invoices
  where deleted_at is null
  group by contract_id, issue_date
  having count(*) > 1
) d;
```

### Post-apply checks for fixed blockers

```sql
-- 20260713000002: no invalid FK, trigger guard exists
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.owner_balances'::regclass
  and conname = 'owner_balances_owner_id_fkey';
-- Expected: zero rows

select tgname, tgrelid::regclass::text as table_name, tgenabled
from pg_trigger
where tgname = 'trg_prevent_owner_delete_with_balances'
  and tgrelid = 'public.owners'::regclass
  and not tgisinternal;
-- Expected: one enabled trigger

-- 20260713000007: update expense RPC exists and uses text-safe body
select proname, pg_get_function_identity_arguments(oid) as args, prosecdef
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'update_expense_with_journal_atomic';
-- Expected: one SECURITY DEFINER function with jsonb arg

select prosrc like '%v_expense_id text%' as expense_id_text,
       prosrc not like '%v_expense_id uuid%' as no_expense_uuid_var
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'update_expense_with_journal_atomic';
-- Expected: true, true

-- 20260714000003: contract balance trigger functions and triggers exist
select proname, prosecdef
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('update_contract_balance_from_invoice','update_contract_balance_from_allocation')
order by proname;
-- Expected: both exist, SECURITY DEFINER

select tgname, tgrelid::regclass::text as table_name, tgenabled
from pg_trigger
where tgname in ('trg_invoices_update_contract_balance','trg_receipt_allocations_update_contract_balance')
  and not tgisinternal
order by tgname;
-- Expected: both enabled

select prosrc like '%v_contract_id text%' as contract_id_text,
       prosrc not like '%v_contract_id uuid%' as no_contract_uuid_var,
       prosrc like '%c.unit_id::text%' as unit_casted_to_text
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('update_contract_balance_from_invoice','update_contract_balance_from_allocation')
order by proname;
-- Expected for both rows: true, true, true
```

---

## Deployment recommendation

Do not approve Production `supabase db push` until:

1. These edited pending migrations are reviewed in Git diff.
2. A rollback-only dry-run of the full pending migration set succeeds.
3. Verification SQL above passes against a staging clone or rollback-only production transaction.
4. The two newer hardening migrations (`20260715000001`, `20260715000002`) are included in the final pending-set review.
