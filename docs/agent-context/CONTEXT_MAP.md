# Context map — where a task starts

**This file is the authority on what's mandatory vs. optional for a given
task.** `AGENTS.md` sends every agent here first; nothing else in
`docs/agent-context/` is required reading by default. Find your task below
and read only what's listed. If your task spans two rows, read both rows'
lists — not the whole table, and not every file in the repo.

Each row tells you: what to read in `docs/agent-context/DOMAIN.md` (if
anything applies), when `docs/agent-context/WORKFLOW.md` is worth reading in
full, which code/backend/test files to check, and any known live caveat.

## Financial change (invoice / payment / receipt / expense / settlement)

- Domain context: `docs/agent-context/DOMAIN.md` → "Durable verified
  invariants" (id-type mismatch class) and "Known current violations"
  (payments/receipts id linkage — read this before touching receipts or
  voiding, see caveat below). Background: `docs/DOMAIN.md` (entity
  definitions for Invoice/PaymentReceipt/Expense/OwnerSettlement).
- Workflow: read `docs/agent-context/WORKFLOW.md` in full — this area has a
  dedicated high-risk section.
- Code: the relevant `rentrix-app/src/features/financials/<area>/*Service.ts`
  and its `use*.ts` hook; `rentrix-app/src/domain/financial-settlements.ts`;
  `rentrix-app/src/lib/moneyNormalization.ts`;
  `rentrix-app/src/features/financials/financialMath.ts`.
- Backend: `supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql`
  defines the original `record_invoice_payment_atomic`/`void_receipt_atomic`/
  `find_payment_account_id`; search `supabase/migrations/` for later
  filenames containing `payment`, `receipt`, or `invoice` for fixes applied
  since (the directory is not guaranteed complete or in sync with
  production — verify live before relying on any one file, see
  `docs/CURRENT_STATE.md`).
- Tests: colocated tests in the same feature folder, plus the whole
  `test:financials` suite (`docs/TESTING.md`) — always run this one for any
  financial change, even one that looks unrelated on the surface.
- **Live caveat**: `docs/CURRENT_STATE.md` has a section titled "🔴 CRITICAL
  — voidReceipt is broken in production" describing payments/receipts using
  two unlinked UUIDs. A later migration file,
  `supabase/migrations/20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql`,
  implements the fix described there as "Option A" (shared id). Whether that
  fix is applied to the live project and whether `docs/CURRENT_STATE.md` has
  been updated to reflect it were **not verified live** as part of this
  routing layer — check both before assuming either the bug or the fix is
  current.

## Contract / tenant / owner change

- Domain context: `docs/DOMAIN.md` (LeaseContract, OwnerAgreement, Tenant,
  Owner), `docs/agent-context/DOMAIN.md` → "Durable verified invariants"
  (tenant identity resolves through `people`, not `tenants`) and "Open
  assumptions and unknowns" (contracts/people id column type — see note
  there before assuming `uuid` or `text`).
- Workflow: skim `docs/agent-context/WORKFLOW.md`'s high-risk section only
  if your change touches an RPC signature or a migration.
- Code: `rentrix-app/src/features/contracts/`,
  `rentrix-app/src/features/owners/`, `rentrix-app/src/features/tenants/`,
  `rentrix-app/src/features/people/`.
- Backend: `create_contract_atomic`, `renew_contract_atomic` (search
  `supabase/migrations/` by function name — several fix migrations exist,
  e.g. `20260706022048_fix_renew_contract_atomic_payload_mismatch.sql`,
  `20260706023440_fix_create_contract_atomic_tenant_id_type_mismatch.sql`);
  `owner_agreements` (`supabase/migrations/20260628100000_owner_agreements_core.sql`,
  view `vw_active_owner_agreements`).
- Tests: colocated tests under the feature folders above.

## Permissions / auth / RLS change

- Domain context: `docs/agent-context/DOMAIN.md` → "Durable verified
  invariants" (JWT role source, sessions RLS ownership column, route-guard
  vs. RLS boundary).
- Workflow: read `docs/agent-context/WORKFLOW.md`'s high-risk section for
  RLS — this is one of the areas it covers explicitly.
- Code: `rentrix-app/src/features/auth/permissions.ts`,
  `rentrix-app/src/features/auth/route-guards.ts`, `rentrix-app/src/routeTree.ts`
  (route-level `beforeLoad` guards and `staticData`).
- Backend: live `pg_policies` for the affected table(s) — do not rely on a
  migration file alone; `custom_access_token_hook`
  (`supabase/migrations/20260706014138_fix_custom_access_token_hook_role_source.sql`)
  if the change touches JWT role resolution.
- Tests: `rentrix-app/src/features/auth/permissions.test.ts` and any
  route-guard tests; run the full suite, not just auth, since permission
  changes can affect any gated route.
- This is a high-risk area: any live RLS or RPC change needs the sign-off
  described in `docs/GOVERNANCE.md` before it's applied to
  `nnggcnpcuomwfuupupwg`.

## Reports change

- Domain context: `docs/CURRENT_STATE.md` → "Reports page RPC wiring"
  section (which RPCs exist live, which have zero frontend callers, and the
  status of swapping client-side calculations for them).
- Workflow: read `docs/agent-context/WORKFLOW.md`'s high-risk section for
  RPCs if you're touching a `rpt_*` function.
- Code: `rentrix-app/src/features/financials/reports/financialReportsService.ts`
  and `rentrix-app/src/features/reports/reports-page.helpers.ts` (the
  client-side recalculation path — check whether your change should target
  this or the underlying RPC, per the current-state notes).
- Backend: `rpt_*` functions in `supabase/migrations/` — confirm each one's
  actual source table(s) live via `pg_get_functiondef` before assuming it
  matches the client-side version it might replace (the payments/receipts
  split matters here — see the financial-change row's live caveat).
- Tests: colocated tests in `features/financials/reports/` and
  `features/reports/`.

## Schema / migration / RPC change

- Domain context: `docs/agent-context/DOMAIN.md` → "Durable verified
  invariants" (id-type mismatch class, RPC-overload trap) and "Open
  assumptions and unknowns" (contracts/people column-type contradiction
  between the baseline migration file and later fix-migration comments —
  read this before assuming either source is correct without a live check).
- Workflow: read `docs/agent-context/WORKFLOW.md` in full — most of its
  high-risk rules apply here.
- Start: `supabase/migrations/README.md`, `docs/CURRENT_STATE.md` (current
  live-vs-file drift status — check whether the tables/functions you're
  touching are even accurately represented in a migration file today).
- Before writing DDL: verify the live schema directly (`information_schema`,
  `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_get_functiondef`) — do
  not infer column types from generated TypeScript (`types/database.ts`) or
  from another table's naming convention.
- After writing DDL: this repo's filename convention is
  `<14-digit-timestamp>_<snake_case_name>.sql` (enforced by
  `scripts/collect-supabase-migration-evidence.sh`, run via
  `pnpm supabase:migration-evidence`).
- Applying to production requires explicit product-owner sign-off per
  change — see `docs/GOVERNANCE.md`. Log every applied mutation in
  `docs/GOVERNANCE_LOG.md`.
- Tests: any contract test tied to the function/table — e.g.
  `rentrix-app/src/features/financials/payment-account-resolution-migration-contract.test.ts`
  is the existing pattern for RPC-behavior contract tests.

## UI-only change (styling, copy, layout, no data/permission logic)

- Domain context: none required.
- Workflow: `docs/agent-context/WORKFLOW.md` not required — this is a
  trivial/low-risk task type.
- Start: the specific feature folder's page component; `docs/PRODUCT.md` if
  you need to confirm what a section is for.
- Code: `rentrix-app/src/components/ui/` and `components/layout/` if the
  change touches shared primitives (in which case run the full test suite,
  since many features share these components — see `docs/TESTING.md`).
- Tests: colocated tests for the component/page; manual check in
  `pnpm --filter ./rentrix-app dev`, including RTL layout and Arabic text
  rendering (`docs/TESTING.md` → "Manual checks" — there is no automated
  visual/E2E suite).
