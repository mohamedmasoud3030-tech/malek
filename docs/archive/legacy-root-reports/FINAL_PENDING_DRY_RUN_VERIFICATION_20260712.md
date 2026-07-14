# Final Pending Migration Dry-Run Verification

Date: 2026-07-12  
Scope: pending migrations `20260713000002` → `20260715000002`  
Production action: **No `supabase db push` executed. No persistent Production mutation.**

## Method

I ran a rollback-only dry-run against Production using the pending SQL files in timestamp order.

Important safety detail: some migration files contain top-level `BEGIN;` / `COMMIT;`. For rollback-only verification, I stripped only those top-level transaction-control lines and wrapped the full ordered set in one outer transaction:

```sql
BEGIN;
SET LOCAL statement_timeout = '120s';
-- pending migrations in order, top-level BEGIN/COMMIT stripped
ROLLBACK;
```

This prevents an inner `COMMIT` from persisting changes during verification.

---

## Additional blockers found during this final verification

The first dry-run did uncover two additional blockers outside the original three. I fixed them locally and re-ran the full dry-run.

### Additional blocker 1 — `20260713000004_fix_expense_rpc_role_check.sql`

**Failure:**

```text
Post-flight check failed: function still contains is_app_user check
```

**Cause:** the function body comment contained the literal text `is_app_user`, so the post-flight `prosrc LIKE '%is_app_user%'` check failed even though executable logic used `is_admin_or_manager()`.

**Fix:** changed the comment inside the function body from:

```sql
-- CHANGED: was is_app_user(), now is_admin_or_manager()
```

to:

```sql
-- Auth check tightened to ADMIN/MANAGER only.
```

### Additional blocker 2 — `20260714000006_fix_rpt_financial_summary_status.sql`

**Failures:**

1. PostgreSQL cannot change return type using `CREATE OR REPLACE FUNCTION`:

```text
cannot change return type of existing function
HINT: Use DROP FUNCTION rpt_financial_summary(date,date) first.
```

2. `invoices.due_date` is `text` in Production, but function used:

```sql
due_date < current_date
```

which fails as `text < date`.

**Fixes:**

```sql
DROP FUNCTION IF EXISTS public.rpt_financial_summary(date, date);
```

before recreating the function, and:

```sql
NULLIF(due_date, '')::date < current_date
```

for overdue calculations.

---

## Final full pending dry-run result

After the fixes above, the full ordered rollback-only dry-run passed:

```text
HTTP_STATUS:201
Result: []
```

## PASS/FAIL per migration

| Order | Migration | Result | Notes |
|---:|---|---|---|
| 1 | `20260713000002_fix_owner_balances_cascade.sql` | PASS | Fixed: no invalid text→uuid FK; trigger-based owner hard-delete guard. |
| 2 | `20260713000003_fix_receipt_allocations_cascade.sql` | PASS | FK receipt allocation RESTRICT migration compiled/applied in rollback. |
| 3 | `20260713000004_fix_expense_rpc_role_check.sql` | PASS | Fixed false-positive post-flight comment blocker. |
| 4 | `20260713000005_fix_void_receipt_anon_grant.sql` | PASS | Permission-only migration. |
| 5 | `20260713000006_fix_report_rpcs_security_definer.sql` | PASS | Report function security/grant changes. |
| 6 | `20260713000007_add_update_expense_with_journal_atomic.sql` | PASS | Fixed `expenses.id text` handling. |
| 7 | `20260713000008_add_journal_batch_balance_check.sql` | PASS | Adds nullable `journal_entries.batch_id`, trigger, close function. |
| 8 | `20260714000001_seed_revenue_account.sql` | PASS | Account seed is idempotent. |
| 9 | `20260714000002_hardened_invoice_generation.sql` | PASS | Compiles after `batch_id` migration; unique index dry-run passed. |
| 10 | `20260714000003_contract_balances_triggers.sql` | PASS | Fixed text ID variables and `unit_id::text`; trigger functions compile. |
| 11 | `20260714000004_fix_rpt_cash_flow_void_filter.sql` | PASS | Report function rewrite. |
| 12 | `20260714000005_fix_rpt_vat_return_void_filter.sql` | PASS | Report function rewrite. |
| 13 | `20260714000006_fix_rpt_financial_summary_status.sql` | PASS | Fixed drop/recreate and `due_date` text cast. |
| 14 | `20260715000001_drop_stale_soft_delete_contract_uuid_overload.sql` | PASS | Idempotent stale RPC overload drop. |
| 15 | `20260715000002_purge_production_qa_seed_data.sql` | PASS | QA cleanup guards passed in rollback. |

---

## Static search of pending SQL files

Searched all pending files for:

- uuid variables
- `::uuid` casts
- ID comparisons
- foreign keys
- triggers on `invoices`, `payments`, `receipts`, `receipt_allocations`

### Findings summary

#### UUID variables / casts

| File | Finding | Assessment |
|---|---|---|
| `20260713000004_fix_expense_rpc_role_check.sql` | `v_property_id uuid`, `v_cost_center_id uuid`, `v_contract_id uuid`, `v_expense_id uuid`; casts from payload | **Residual risk, not dry-run blocker.** Production text IDs are currently UUID-shaped after QA cleanup except the QA property. PostgreSQL can assign uuid values into text columns. This RPC still rejects future non-UUID text IDs. |
| `20260713000008_add_journal_batch_balance_check.sql` | `close_journal_batch(p_batch_id uuid)` | Expected: new `journal_entries.batch_id` is uuid. |
| `20260714000002_hardened_invoice_generation.sql` | `v_invoice_id uuid`, `v_batch_id uuid` | Acceptable: invoice default generates UUID-shaped text; assignment/casts passed compile. `batch_id` is uuid. |
| `20260715000002_purge_production_qa_seed_data.sql` | `v_qa_agreement_id uuid` | Expected: `owner_agreements.id` / `contracts.agreement_id` are uuid. |

No remaining `v_contract_id uuid` or `v_expense_id uuid` blockers remain in the two previously fixed migrations:

- `20260713000007_add_update_expense_with_journal_atomic.sql`
- `20260714000003_contract_balances_triggers.sql`

#### Foreign keys

| File | FK-related finding | Assessment |
|---|---|---|
| `20260713000003_fix_receipt_allocations_cascade.sql` | Recreates `receipt_allocations(receipt_id) -> receipts(id)` with `ON DELETE RESTRICT` | Valid: both sides are text in Production. |
| `20260713000002_fix_owner_balances_cascade.sql` | No FK created after fix | Correct: avoids invalid `text -> uuid` FK. |

#### Triggers on financial tables

| File | Trigger | Assessment |
|---|---|---|
| `20260714000003_contract_balances_triggers.sql` | `AFTER INSERT OR UPDATE OR DELETE ON public.invoices` | Passed rollback simulation. Medium/high residual operational risk because it runs on invoice writes. |
| `20260714000003_contract_balances_triggers.sql` | `AFTER INSERT OR DELETE ON public.receipt_allocations` | Passed rollback simulation. |
| `20260713000008_add_journal_batch_balance_check.sql` | `AFTER INSERT ON public.journal_entries WHEN batch_id IS NOT NULL` | Not one of requested invoice/payment/receipt triggers; expected accounting batch warning trigger. |

No triggers on `public.payments` or direct triggers on `public.receipts` were introduced by this pending set.

---

## Rollback simulation results

I applied the full pending set inside one rollback-only transaction, inserted temporary dry-run domain rows, and tested the financial triggers.

### A) Invoice insert → contract balance trigger

Simulation inserted a dry-run contract and invoice:

- invoice amount = `100`
- tax = `5`
- paid = `0`

Expected contract balance:

- `total_invoiced = 105`
- `total_paid = 0`
- `balance_due = 105`

Result:

| simulation | total_invoiced | total_paid | balance_due | pass |
|---|---:|---:|---:|---:|
| `A_invoice_insert_contract_balance` | 105 | 0 | 105 | true |

### B) Receipt allocation insert → contract balance trigger

Simulation then:

1. Set invoice `paid_amount = 40`.
2. Deliberately corrupted `contract_balances` inside the transaction.
3. Inserted receipt + receipt allocation.
4. Verified allocation trigger repaired the balance.

Expected contract balance:

- `total_invoiced = 105`
- `total_paid = 40`
- `balance_due = 65`

Result:

| simulation | total_invoiced | total_paid | balance_due | pass |
|---|---:|---:|---:|---:|
| `B_receipt_allocation_contract_balance` | 105 | 40 | 65 | true |

### No persistence check

After rollback:

| Check | Result |
|---|---:|
| dry-run contract rows persisted | 0 |
| dry-run invoice rows persisted | 0 |
| `journal_entries.batch_id` column persisted | 0 |
| stale `soft_delete_contract_atomic(uuid)` still exists after rollback | 1 |

This confirms the dry-run/simulation did not persist Production changes.

---

## Diff summary after all fixes

Modified files now include five pending migrations:

```text
20260713000002_fix_owner_balances_cascade.sql       | fixed invalid FK by trigger guard
20260713000004_fix_expense_rpc_role_check.sql       | fixed false-positive post-flight check
20260713000007_add_update_expense_with_journal_atomic.sql | fixed expenses.id text handling
20260714000003_contract_balances_triggers.sql       | fixed contract/tenant/unit text handling
20260714000006_fix_rpt_financial_summary_status.sql | fixed drop/recreate + due_date text cast
```

Diff stats:

```text
5 files changed, 133 insertions(+), 64 deletions(-)
```

---

## Remaining blockers

**No remaining hard blockers found** in rollback-only execution or in the two trigger simulations.

## Remaining risks / non-blocking cautions

1. `20260713000004_fix_expense_rpc_role_check.sql` still uses uuid variables for create-expense input IDs while target columns are text. This is not a dry-run blocker and current non-QA IDs are UUID-shaped, but it preserves a stricter UUID-only input contract than the text schema technically allows.
2. `20260714000003_contract_balances_triggers.sql` adds triggers to invoice/allocation paths. Simulations passed, but operational risk remains medium/high because all future invoice writes will execute these functions.
3. `20260714000006_fix_rpt_financial_summary_status.sql` now casts `NULLIF(due_date, '')::date`. This assumes non-empty `due_date` text values are date-parseable. Current migration compiles, but malformed historical due dates would affect report execution.

---

## Final decision

**Decision: `supabase db push` is technically safe from the identified migration execution blockers after the current local fixes are included.**

I still recommend treating approval as conditional on reviewing/accepting the five-file diff above, because the pending set includes financial triggers and report/RPC rewrites. But based on the final rollback-only dry-run and trigger simulations, I do **not** see a remaining blocker that would prevent `db push` from applying successfully.
