# Domain — invariants and evidence (agent supplement)

This file does not replace `docs/DOMAIN.md` (entity list and relationships) or
`docs/CURRENT_STATE.md` (live schema/verification status). Read those first.
This file adds two things they don't already cover: a tagged list of
financial/authorization invariants an agent must not break, and the specific
evidence for each. Every line is tagged:

- **Verified** — confirmed against code, a migration file, a test, or a live
  read-only query (query type noted).
- **Inferred** — a reasonable reading of the evidence, not independently
  confirmed (e.g. no test asserts it directly).
- **Unknown** — not established either way; do not assume.

If you find a line here that no longer matches the code or live schema,
correct it in the same PR as your change and say so in the PR description.

## Critical invariants

1. **A single payment/receipt transaction must not be represented by two
   unlinked rows.** — **Verified broken today**: `record_invoice_payment_atomic`
   writes to `public.receipts` (via `post_receipt_atomic`) and separately to
   `public.payments`, with two independently generated UUIDs and no column
   linking them. Source: `docs/CURRENT_STATE.md` → "🔴 CRITICAL — voidReceipt
   is broken in production" section, and
   `rentrix-app/src/features/financials/receipts/receiptService.ts` →
   `voidReceipt`. Do not "fix" this incidentally as part of an unrelated
   change — it needs the explicit Option A/B decision documented there first.

2. **Invoice status must not desync from its actual paid amount.** —
   **Inferred**: `Invoice.status` (`unpaid` | `partially_paid` | `paid` |
   `overdue` | `cancelled`) exists as a denormalized field alongside the
   underlying payments; no single test was found that specifically asserts
   status recomputation on every payment/void path. Treat any change to
   payment recording or voiding as a status-consistency risk until you've
   traced `record_invoice_payment_atomic` and `void_receipt_atomic` end to
   end for the invoice being touched. Source:
   `supabase/migrations/20250101000003_functions_triggers_and_rpcs.sql`
   (function bodies), `docs/DOMAIN.md` (Invoice status enum).

3. **A financial record must not be deleted or voided without leaving an
   accounting trace.** — **Inferred** from `void_receipt_atomic` existing as
   a dedicated void path (rather than the frontend issuing a raw `DELETE`)
   and from `AuditEvent`/`audit-log` existing as a governance surface. No
   test was found asserting "every void/delete produces an audit row" as a
   blanket rule — verify per-entity before relying on it. Source:
   `rentrix-app/src/features/financials/receipts/receiptService.ts`,
   `rentrix-app/src/features/audit/`.

4. **`contracts.tenant_id` must resolve through `people`, not `tenants`.** —
   **Verified**: `contracts.tenant_id` has a real foreign key,
   `contracts_tenant_id_people_app_fkey → people(id)`. The `tenants` table
   (40 live rows) has no FK relationship to `contracts` and is legacy/orphaned
   for this purpose. Do not add new tenant lookups against `tenants`. Source:
   live `information_schema`/`pg_constraint` query (see recent schema-audit
   findings referenced in `docs/CURRENT_STATE.md`); confirmed again while
   fixing `renew_contract_atomic`/`create_contract_atomic`/
   `void_receipt_atomic`/`rpt_owner_statement`/`rpt_tenant_statement` (PRs
   #1054, #1055, #1056).

5. **Never compare a `uuid` column to a `text` column in SQL (`WHERE`/`JOIN`).**
   — **Verified**: Rentrix mixes id types across tables — `units`, `owners`,
   `owner_agreements` use `uuid`; `contracts`, `receipts`, `people`,
   `properties`, `invoices`, `journal_entries`, `receipt_allocations`,
   `expenses` use `text`. `text = uuid` has no operator and raises a hard
   error at runtime, not at CREATE FUNCTION time. This exact bug class was
   found and fixed in `renew_contract_atomic`, `create_contract_atomic`,
   `void_receipt_atomic`, `rpt_owner_statement`, `rpt_tenant_statement` (PRs
   #1054, #1055, #1056). Before writing or editing any RPC that joins or
   filters across tables, check both sides' actual column types via
   `information_schema.columns` — do not assume from the column name or from
   generated TypeScript types (see `docs/DOMAIN.md`, first line).

6. **Changing an RPC parameter type creates a new overload instead of
   replacing the function.** — **Verified**: `CREATE OR REPLACE FUNCTION`
   with a changed parameter type leaves two ambiguous candidate signatures
   for PostgREST's `rpc()` calls. Fixes must either explicitly
   `DROP FUNCTION` the old signature first, or (preferred, safer) keep the
   parameter signature unchanged and cast internally instead. Source: fix
   history for the PRs above.

7. **JWT role resolution reads `public.users.role`, not
   `public.profiles.role`.** — **Verified**: `custom_access_token_hook` was
   found reading the role claim from `public.profiles.role` (structurally
   capped at `ADMIN`/`USER` by `profiles_role_check`, so it could never be
   `MANAGER`) instead of `public.users.role` (the enum RLS already trusts).
   Fixed live via `20260706014138_fix_custom_access_token_hook_role_source.sql`.
   Do not reintroduce a role read from `profiles`. Source:
   `docs/NEXT.md` → "Phase 0 Settings + Auth" (F0-6),
   `docs/PHASE_0_SETTINGS_AUTH_AUDIT.md`.

8. **RLS ownership checks on `sessions` compare `auth.uid()` to
   `sessions.user_id`, not `sessions.id`.** — **Verified**: the live
   `sessions_select_own` / `sessions_insert_own` / `sessions_delete_own`
   policies were captured comparing `auth.uid()` to the row's own primary
   key (`sessions.id`), which is wrong; fixed by
   `20260705000004_fix_sessions_rls_user_id.sql` and confirmed live via
   `pg_policies`. Source: `docs/CURRENT_STATE.md` → "Baseline capture
   strategy and ordering", `docs/GOVERNANCE_LOG.md`.

9. **Route/UI permission gates are the only enforced authorization layer on
   the client; the real authority is RLS + the JWT role claim.** —
   **Inferred**: `rentrix-app/src/features/auth/permissions.ts` defines
   `ADMIN`/`MANAGER`/`USER` and per-permission sets; `route-guards.ts` reads
   these before rendering. This is a UX gate, not a security boundary — do
   not treat "the route guard blocks it" as equivalent to "RLS blocks it."
   Any new sensitive operation needs its own RLS policy verified live, not
   just a permission check in the route. Source:
   `rentrix-app/src/features/auth/permissions.ts`,
   `rentrix-app/src/features/auth/route-guards.ts`.

10. **`commissions` is an operational tracking feature, not a
    payout/accounting module.** — **Verified**: confirmed from navigation
    copy, UI, service layer, tests, and the captured `commissions` table
    shape. The table has an `expense_id` column the frontend does not read
    or write. Do not wire commissions into settlements, expenses, or
    ledger entries without a new design + migration + atomic RPC. Source:
    `docs/DOMAIN.md` → "Commissions" bullet,
    `rentrix-app/src/features/commissions/`.

## Unknowns worth flagging before you build on them

- **Security deposits, deferred revenue, multi-currency amounts** — **Unknown
  as modeled features**: not found in migrations or `src/features` as of the
  last check. `Invoice`/`Expense`/`PaymentReceipt` all use a single
  unqualified `amount` number. Source: `docs/NEXT.md` → "Later".
- **Bank reconciliation completeness** — **Verified partial**: foundation
  schema/UI, CSV paste import, and basic date/amount suggested matches exist
  live. Bank-file upload/format mapping, duplicate detection, and advanced
  reconciliation rules are **Unknown/not built**. Source: `docs/NEXT.md`,
  `docs/CURRENT_STATE.md`.
- **Whether every RLS policy in `supabase/migrations/` matches what's live**
  — **Unknown by default**: migration files are not a complete or
  necessarily accurate mirror of the live project (see
  `supabase/migrations/README.md`). Re-verify via `pg_policies` for any RLS
  policy you're about to rely on or change.
