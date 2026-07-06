# Context map — where a task starts

A small task should need the smallest file set below, not the whole repo.
Read `AGENTS.md` first regardless of task type. Then find your task below
and read only what's listed before touching code. If your task spans two
rows, read both rows' lists, not the whole table.

## Financial change (invoice / payment / receipt / expense / settlement)

- Start: `docs/agent-context/DOMAIN.md` (invariants 1–3, 5, 6), `docs/DOMAIN.md`
  (entity definitions for Invoice/PaymentReceipt/Expense/OwnerSettlement).
- Code: the relevant `rentrix-app/src/features/financials/<area>/*Service.ts`
  and its `use*.ts` hook; `rentrix-app/src/domain/financial-settlements.ts`;
  `rentrix-app/src/lib/moneyNormalization.ts`.
- Backend: `supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql`
  for `record_invoice_payment_atomic`/`void_receipt_atomic`/
  `find_payment_account_id`; any later migration with `payment`, `receipt`,
  or `invoice` in the filename (check `supabase/migrations/` by name, then
  verify live — the directory is not guaranteed complete, see
  `docs/CURRENT_STATE.md`).
- Tests: colocated tests in the same feature folder, plus the whole
  `test:financials` suite (`docs/TESTING.md`) — always run this one for any
  financial change, even a change that looks unrelated on the surface.
- Known live issue to check before you start: the voidReceipt bug in
  `docs/CURRENT_STATE.md` ("🔴 CRITICAL"). If your task touches receipts or
  voiding, read that section fully before writing code.

## Contract / tenant / owner change

- Start: `docs/DOMAIN.md` (LeaseContract, OwnerAgreement, Tenant, Owner),
  `docs/agent-context/DOMAIN.md` (invariant 4: tenant identity via `people`,
  not `tenants`).
- Code: `rentrix-app/src/features/contracts/`, `rentrix-app/src/features/owners/`,
  `rentrix-app/src/features/tenants/`, `rentrix-app/src/features/people/`.
- Backend: `create_contract_atomic`, `renew_contract_atomic` (search
  `supabase/migrations/` by name); `owner_agreements` migration
  (`20260628100000_owner_agreements_core.sql`) and its
  `vw_active_owner_agreements` view.
- Tests: colocated tests under the feature folders above.

## Permissions / auth / RLS change

- Start: `docs/agent-context/DOMAIN.md` (invariants 7–9).
- Code: `rentrix-app/src/features/auth/permissions.ts`,
  `rentrix-app/src/features/auth/route-guards.ts`, `rentrix-app/src/routeTree.ts`
  (route-level `beforeLoad` guards and `staticData`).
- Backend: live `pg_policies` for the affected table(s) — do not rely on a
  migration file alone; `custom_access_token_hook` if the change touches JWT
  role resolution (see invariant 7 for the past bug in this exact function).
- Tests: `rentrix-app/src/features/auth/permissions.test.ts` and any
  route-guard tests; run the full suite, not just auth, since permission
  changes can affect any gated route.
- This is a high-risk area: any live RLS or RPC change needs the sign-off
  described in `docs/GOVERNANCE.md` before it's applied to
  `nnggcnpcuomwfuupupwg`.

## Reports change

- Start: `docs/CURRENT_STATE.md` → "Reports page RPC wiring" section (which
  RPCs exist live, which have zero frontend callers, and why the swap to
  `rpt_owner_statement`/`rpt_tenant_statement`/etc. is paused pending a
  decision).
- Code: `rentrix-app/src/features/financials/reports/financialReportsService.ts`
  and `rentrix-app/src/features/reports/reports-page.helpers.ts` (the
  client-side recalculation path — check whether your change should target
  this or the underlying RPC, per the current-state notes).
- Backend: `rpt_*` functions — confirm each one's actual source table(s)
  live via `pg_get_functiondef` before assuming it matches the client-side
  version it might replace (the receipts/payments split matters here, see
  invariant 1).
- Tests: colocated tests in `features/financials/reports/` and
  `features/reports/`.

## Schema / migration / RPC change

- Start: `supabase/migrations/README.md`, `docs/CURRENT_STATE.md` (current
  live-vs-file drift status — check whether the tables/functions you're
  touching are even accurately represented in a migration file today).
- Before writing DDL: verify the live schema directly (`information_schema`,
  `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_get_functiondef`) — do
  not infer column types from generated TypeScript (`types/database.ts`) or
  from another table's naming convention (see invariant 5).
- After writing DDL: this repo's convention is filename
  `<14-digit-timestamp>_<snake_case_name>.sql` (enforced by
  `scripts/collect-supabase-migration-evidence.sh`, run via
  `pnpm supabase:migration-evidence`).
- Applying to production requires explicit product-owner sign-off per
  change — see `docs/GOVERNANCE.md`. Log every applied mutation in
  `docs/GOVERNANCE_LOG.md`.
- Tests: any contract test tied to the function/table (e.g.
  `rentrix-app/src/features/financials/payment-account-resolution-migration-contract.test.ts`
  is the pattern to follow for new RPC-behavior contract tests).

## UI-only change (styling, copy, layout, no data/permission logic)

- Start: the specific feature folder's page component; `docs/PRODUCT.md` if
  you need to confirm what a section is for.
- Code: `rentrix-app/src/components/ui/` and `components/layout/` if the
  change touches shared primitives (in which case run the full test suite,
  since many features share these components — see `docs/TESTING.md`).
- Tests: colocated tests for the component/page; manual check in
  `pnpm --filter ./rentrix-app dev`, including RTL layout and Arabic text
  rendering (`docs/TESTING.md` → "Manual checks" — there is no automated
  visual/E2E suite).
