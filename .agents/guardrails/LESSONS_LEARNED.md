# LESSONS_LEARNED — Rentrix Production Incident Memory

This file is **mandatory reading** for ANY agent/developer touching financials,
RLS, auth, RPCs, contracts, receipts, or migrations. Read it before writing code.
These are real bugs found in production QA on 2026-07-11 that caused primary
business flows to silently fail. Your code MUST NOT reintroduce them.

---

## 1. ID-type mismatches between migrations and live DB

**What happened**: Multiple migrations declared columns as `uuid` while the live
production schema used `text` (e.g. `contracts.id`, `contract_documents.contract_id`,
`tenants.id` vs `people.id`). Joins/RPCs that cast to the wrong type silently broke.

**Rule**:
- Before writing any RPC, migration, or query, verify the actual column type on
  the live database via `pg_typeof(column_name)` or `information_schema.columns`
  — do NOT assume from generated TS types or from the filename of an older
  migration.
- The canonical tenant FK is `public.people(id)`, NOT the legacy
  `public.tenants(id)`. All tenant balances, receipts, invoices must reference
  `people(id)`. See migration `20260712020000_fix_tenant_balances_people_fk.sql`.
- All `contracts.*_id` columns are `text` (not `uuid`) — treat them as text in
  RPC parameters; never cast `text → uuid` without live verification.

**Test you MUST include**: a migration-contract test (model:
`payment-account-resolution-migration-contract.test.ts`) that asserts parameter
types match the actual column types via `pg_typeof` against a seeded DB.

---

## 2. RLS helper functions MUST have GRANT EXECUTE TO authenticated

**What happened**: `is_admin_or_manager()` and `is_app_user()` were created
without `GRANT EXECUTE ON FUNCTION ... TO authenticated`. This silently blocked
ALL RLS-gated access to 8 tables (commissions, communication_records,
contract_documents, cost_centers, lands, leads, owner_agreements,
payment_terms_templates) — users got empty results with no obvious error.

**Rule**:
- After creating/altering any SECURITY DEFINER function used by RLS or UI,
  append a `GRANT EXECUTE ON FUNCTION ... TO authenticated` statement.
- Explicitly `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon` for any helper
  whose name starts with `find_*`, `assert_*`, `validate_*`, `compute_*` or that
  is not intended to be called from the UI.
- Document the grant in the migration header.

**Test you MUST include**: after applying the migration, run a query as an
authenticated non-admin user that exercises the policy — do not rely on
"compiles cleanly" as proof.

---

## 3. Trigger functions must reference columns that actually exist on the row

**What happened**:
- `update_owner_balance_on_expense()` trigger was attached to `receipts` but
  referenced `NEW.property_id`, which does not exist on receipts.
  → No receipt had ever been successfully posted in production.
- `update_tenant_balance()` trigger was attached to `receipt_allocations` but
  referenced `NEW.contract_id`, which does not exist on that table.
  → `post_receipt_atomic` end-to-end flow broke.

**Rule**:
- Before attaching a trigger to a table, list the columns of the table and
  verify every `NEW.x` / `OLD.x` reference exists on THAT table.
- Triggers are the single easiest place to silently break write paths — they
  run inside the same transaction as the user's insert, so a missing column
  aborts the whole operation with a message the UI may mask.
- Never reuse a trigger function across tables with different shapes.
- Write a unit test that inserts a row into the trigger's table and asserts it
  succeeds (doesn't raise "column ... does not exist").

---

## 4. Date / text / parameter casting in RPCs

**What happened**: `create_contract_atomic` compared `text` columns to `date`
parameters without a cast → zero contracts had ever been successfully created
through that RPC path.

**Rule**:
- Be explicit about casts in both directions: `p_start_date::date` for inputs,
  `col::date` for comparisons, or use typed parameters from the start.
- Never rely on implicit casts for `date ↔ text ↔ timestamptz`.
- When the contract test runs, include a "happy path" insert through the RPC
  and SELECT the row back to verify it was actually created.

---

## 5. Session RLS ownership must compare auth.uid() to a user_id column

**What happened**: Sessions RLS originally compared `auth.uid()` to
`sessions.id` instead of `sessions.user_id`, hiding users from their own sessions.

**Rule**:
- Every ownership RLS policy must compare `auth.uid()` to a column that
  actually stores the owning user's id, not a row id.
- After adding an ownership policy, test it with at least two users: user A
  must see A's rows, user B must NOT see A's rows.

---

## 6. SECURITY DEFINER hygiene

**Rule for ALL SECURITY DEFINER functions**:
1. `SET search_path = public, pg_temp` (or `pg_catalog, public` for low-level
   helpers). NEVER leave `search_path` unset — it's a known privilege
   escalation vector.
2. `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon` for internal helpers.
3. `GRANT EXECUTE ON FUNCTION ... TO authenticated` only for callable RPCs.
4. Use `pg_advisory_xact_lock(hashtextextended(...))` around any mutation that
   must be unique per (entity, period, owner) — see
   `create_owner_settlement_draft_atomic` as a reference pattern.
5. All mutations go through an idempotency table
   (`public.financial_operation_idempotency`) keyed on
   `(operation_name, request_id)` — duplicate RPC calls with the same
   `request_id` MUST return the cached response instead of double-writing.

---

## 7. Date-only inputs in the frontend

**What happened**: Code was using `new Date().toISOString().slice(0,10)` which
produces UTC dates, shifting by timezone and generating the wrong calendar date
for users in UTC+ (like Oman / GST / Arabia).

**Rule**:
- Use `lib/date-input-regression.test.ts`'s guard — date-only values must be
  constructed from LOCAL calendar parts
  (`date.getFullYear()`, `date.getMonth()+1`, `date.getDate()`), never from
  `toISOString().slice(0,10)`.
- A regression test exists and MUST NOT be removed; keep it green.

---

## 8. Receipts / payments source of truth

**Rule**:
- Collection reports MUST compute totals from `public.payments` filtered to
  `status <> 'VOID'` AND `deleted_at IS NULL`.
- Receipts are the user-facing projection/history; they are NOT the financial
  source of truth for totals.
- A VOID payment must remain visible in history but MUST be excluded from
  cash flow, daily collection, payment totals, and owner settlement
  calculations.
- The "cash on reception" office fee rule means office fees are recognized
  from collected (posted, non-void) payments — never from invoices alone.

---

## 9. Migration drift

**What happened**: ~31 live tables had no corresponding migration file; 2
committed migrations were never applied live. The `supabase/migrations/` folder
was therefore not a reliable source of truth.

**Rule**:
- Baseline captures (20260705000000–002) exist and re-align files with live.
  Going forward, every new DDL change MUST have a timestamped migration file
  AND be applied to production only with sign-off (see `docs/GOVERNANCE.md`).
- Before writing a migration:
  1. Run `pnpm supabase:migration-evidence`
  2. If `SUPABASE_DB_URL` + `psql` are available, verify live schema directly.
  3. If a table exists live but not in any local migration, DO NOT create a
     conflicting migration — extend the baseline capture pattern.
- NEVER apply a migration that does destructive DDL (DROP TABLE/COLUMN,
  ALTER TYPE) without verifying zero live dependencies (functions, views,
  policies, triggers).

---

## 10. Never move financial integrity into the client

**Rule**:
- Multi-step financial operations (invoice→payment, approve→pay, settlement
  calculation, fee deduction, deposit offset) MUST run inside an atomic Postgres
  RPC with row locking — NEVER as a sequence of `supabase.from(...).insert()`
  calls from the client.
- The service layer in `*Service.ts` is a typed wrapper around the RPC; it does
  not do its own cross-table writes for money-moving flows.
- Existing atomic RPC patterns to copy:
  - `record_invoice_payment_atomic`
  - `post_receipt_atomic` (in recent fixes)
  - `void_receipt_atomic`
  - `create_contract_atomic` / `update_contract_atomic` /
    `renew_contract_atomic` / `terminate_contract_atomic` /
    `soft_delete_contract_atomic`
  - `resolve_maintenance_with_expense`
  - `create_owner_settlement_draft_atomic` /
    `approve_owner_settlement_atomic` / `pay_owner_settlement_atomic`

---

## 11. Do not invent business rules

If the ADRs (`docs/decisions/0001-*`, `0002-*`, `0003-*`) don't specify a rule,
and the code doesn't either, STOP and escalate — do NOT guess. Specifically:
- Whether a specific fee applies to a specific amount type is a product
  decision.
- Owner payout schedules, proration formulas, tax inclusion, and approval
  thresholds are product decisions.
- When in doubt, follow the same pattern as the nearest implemented feature
  and flag the assumption in the PR description.

---

## 12. Test gates you MUST run before declaring a feature done

- `pnpm typecheck` — types green
- `pnpm --filter ./rentrix-app test` — all unit/integration tests green
- `pnpm --filter ./rentrix-app run test:financials` — if anything touches
  money, formats money, or touches financial features
- `pnpm build` — production build green
- `pnpm supabase:migration-evidence` — if migrations were touched
- `pnpm e2e` (Playwright) — at least one unauthenticated smoke path green
- Manual browser check for Arabic RTL rendering at 320px, 768px, and 1280px
  widths (per `docs/TESTING.md` → Manual checks)

These gates are enforced by CI; do not open a PR with red on any of them.
