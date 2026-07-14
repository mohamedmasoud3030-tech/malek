# Live Supabase Verification — Readiness Review (P0-1)

> Archived on 2026-07-14. This point-in-time P0-1 review contains superseded file-only/live-status claims. Use `docs/RELEASE_READINESS.md`, `docs/CURRENT_STATE.md`, and the exact release-candidate evidence instead.

Scope: P0-1 of the Final Gap Closure. **Review only — no database mutation was
performed.** All evidence below is file-level (migrations, RPC definitions,
contract tests). Live `apply_migration` / `supabase:live-readiness` must be run by
an operator with `SUPABASE_DB_URL` + `psql` before any of these are claimed live.

## 1. Latest migrations (gap-closure batch)

| File | Purpose |
| --- | --- |
| `20260711000001_add_rpt_trial_balance.sql` | Trial Balance RPC (operational, balancing) |
| `20260711000002_add_rpt_income_statement.sql` | Income Statement RPC (accrual) |
| `20260711000003_add_rpt_balance_sheet.sql` | Balance Sheet RPC (operational) |
| `20260711000004_add_create_expense_with_journal_atomic.sql` | Expense + journal + audit atomic RPC |

All four are **file-only** at this commit. They follow the project's established
security baseline (see §2). They must be applied to `nnggcnpcuomwfuupupwg` via
`apply_migration` and then re-verified with `pg_get_functiondef` before going live.

## 2. RPC grants & SECURITY DEFINER posture

Pattern enforced across the new RPCs (and asserted by
`accounting-reports-migration-contract.test.ts` and
`expense-atomic-migration-contract.test.ts`):

- `SECURITY DEFINER`
- `SET search_path TO 'public', 'pg_temp'`
- `REVOKE ALL ON FUNCTION … FROM public, anon;`
- `GRANT EXECUTE ON FUNCTION … TO authenticated, service_role;`

`rpt_cash_flow` / `rpt_vat_return` (pre-existing) grant `authenticated` only;
the new report RPCs additionally grant `service_role` to match the task's
"GRANT authenticated/service_role" requirement and remain consistent with the
atomic payment/expense RPCs.

## 3. RLS state

- `owner_settlements` already has `ENABLE` + `FORCE ROW LEVEL SECURITY` with an
  `is_app_user()` policy (verified in baseline capture migration).
- Sensitive tables covered by the `20260711120000_production_hardening_*` and
  `20260711123000_bank_reconciliation_atomic_and_journal_status_hardening`
  migrations (grants on wrapper functions, immutable posted journal entries,
  audit on journal inserts).
- The historical `sessions` RLS ownership bug (`auth.uid()` vs `sessions.id`) is
  fixed in `20260705000004_fix_sessions_rls_user_id.sql` (applied live per
  `CURRENT_STATE.md`).

## 4. SECURITY DEFINER function hygiene

All new and recently-added functions pin `search_path`. The production-hardening
migration also re-pins and re-owns the core atomic RPCs
(`record_invoice_payment_atomic`, `void_receipt_atomic`,
`create_contract_atomic`, `recalculate_all_balances`, `rpt_cash_flow`,
`rpt_vat_return`, …) and keeps sensitive trigger helpers non-callable from
browser roles. No new `SECURITY DEFINER` function was added without a pinned
search path.

## 5. Known live-verification risks (carry-over, not changed here)

- **Migrations ≠ live schema:** `docs/CURRENT_STATE.md` confirms
  `~31 live tables` are untracked by migration files; the migration directory
  cannot be treated as a source of truth for the live schema. New RPCs were
  written against the documented/used column shapes (e.g. `expenses.status`,
  `expenses.charged_to`, `expenses.date_time`, `expenses.no` referenced by
  `rpt_owner_statement`); verify each against `information_schema.columns` before
  applying.
- **`tenant_balances.tenant_id` FK → legacy `tenants`** (not `people`): will break
  the first invoice/receipt for a tenant created only in `people`. Decision
  pending (see `docs/NEXT.md`). Not touched in this pass.
- **First-ever end-to-end financial cycle** (2026-07-11) found and fixed 4 live
  bugs; a `TEST-QA` cleanup and remaining permission/void/report reconciliation
  checks are still in progress per `docs/NEXT.md`.

## 6. Verification gate before "production ready"

Run, in an approved read-only operator environment:

```bash
pnpm supabase:migration-evidence
pnpm supabase:live-readiness   # requires SUPABASE_DB_URL + psql
```

Then apply the four new migrations via `apply_migration`, re-run
`pnpm supabase:live-readiness`, and confirm `pg_get_functiondef` for
`rpt_trial_balance`, `rpt_income_statement`, `rpt_balance_sheet`, and
`create_expense_with_journal_atomic` matches the committed files.

## 7. Contract Lifecycle Atomic Hardening

### Problem discovered & Previous risk
Prior to this hardening pass (`20260712000000_contract_lifecycle_hardening.sql`), `softDeleteContract()` (`contractService.ts`) performed direct client-side raw table updates (`supabase.from('contracts').update(...)`) bypassing server-side `is_admin_or_manager()` checks and row-locking transactions. Furthermore, soft-deleting a contract left unpaid future invoices active (`deleted_at IS NULL`), distorting tenant receivable balances and trial balance figures. Additionally, `renew_contract_atomic` checked/wrote uppercase statuses (`'ACTIVE'`, `'ENDED'`), causing case mismatches and query failures against lowercase application domain values (`'active'`, `'expired'`, `'draft'`, `'terminated'`).

### New RPC architecture
All contract write operations now use atomic RPCs:
- **CREATE**: `create_contract_atomic`
- **UPDATE**: `update_contract_atomic`
- **RENEW**: `renew_contract_atomic`
- **TERMINATE**: `terminate_contract_atomic`
- **SOFT DELETE**: `soft_delete_contract_atomic`

There are zero direct client-side table writes (`insert()`, `update()`, `delete()`) against `contracts`.

### Financial integrity behavior
When a contract is terminated (`terminate_contract_atomic`) or soft-deleted (`soft_delete_contract_atomic`), all unpaid future invoices (`paid_amount = 0`, `due_date::date > current_date`, `status NOT IN ('CANCELLED', 'PAID')`) are safely updated to `status = 'CANCELLED'`. Invoices with any payment history (`paid_amount > 0`), settled invoices (`PAID`), receipts, and historical journal entries are completely untouched, preventing orphaned financial records and maintaining accounting balance integrity.

### Security model
All contract lifecycle RPCs enforce:
- `SECURITY DEFINER` with pinned `SET search_path TO 'public', 'pg_temp'` and explicit `postgres` ownership.
- Explicit server-side role validation requiring authenticated admin or manager status (`public.is_admin_or_manager()`).
- Explicit permissions revocation from `PUBLIC, anon` (`REVOKE ALL`) and execution granted strictly to `authenticated, service_role`.
- Atomic row locking (`SELECT ... FOR UPDATE`) during update, termination, renewal, and soft deletion to eliminate concurrent race conditions.

### Testing coverage
Covered by unit tests (`contractService.test.ts`) verifying frontend RPC routing and error propagation, and database migration contract tests (`production-hardening-migration-contract.test.ts`) validating RPC signatures, security parameters, authorization guards, and financial protection rules.
