# Domain — invariants and known issues (agent supplement)

This file does not replace `docs/DOMAIN.md` (entity list and relationships)
or `docs/CURRENT_STATE.md` (live-verification log). Read those for context;
this file exists to separate three things that are easy to blur together:
rules that actually hold, rules that are currently *violated* in production,
and things nobody has confirmed either way.

Every claim below is tagged with when and how it was established:

- **Verified directly in this change** — confirmed by this documentation
  pass itself, with the concrete code/migration-file pointer used. This tag
  does **not** mean a live database was queried during this pass — file-level
  static evidence is labeled as such explicitly.
- **Previously verified** — confirmed in an earlier session, per the cited
  source document and (where stated) date. Treat as reliable but re-check if
  your task depends on it and meaningful time has passed.
- **Inferred** — a reasonable reading of the evidence, not directly
  confirmed by a test or an explicit statement.
- **Unknown** — not established either way; do not assume.

If you find a line here that no longer matches the code or live schema,
correct it in the same PR as your change and say so in the PR description.

## Durable verified invariants

These describe rules the code/schema currently enforces or reflects — not
a currently-broken condition (those are in the next section).

1. **`text`/`uuid` id comparisons across tables have no implicit operator
   and raise a hard runtime error, not a compile-time one.** — **Previously
   verified**, per fix-migration comments for `renew_contract_atomic`,
   `create_contract_atomic`, `void_receipt_atomic`, `rpt_owner_statement`,
   `rpt_tenant_statement` (see `supabase/migrations/20260706022048_...`,
   `20260706023440_...`, `20260706023153_...`, `20260706025534_...`,
   `20260706025554_...` — **verified directly in this change** that these
   files exist and each contains a header comment describing exactly this
   bug class). Before writing or editing any RPC that joins or filters
   across tables, check both sides' actual column types via
   `information_schema.columns` on the live project — do not assume from a
   migration file or from generated TypeScript types. See "Open assumptions"
   below: which specific tables are `text` vs. `uuid` is not settled by the
   files alone.

2. **Changing an RPC's parameter type via `CREATE OR REPLACE FUNCTION`
   creates a new overload instead of replacing the function**, leaving two
   ambiguous candidates for PostgREST's `rpc()` calls. — **Previously
   verified**: `supabase/migrations/20260706022859_drop_stale_renew_contract_atomic_uuid_overload.sql`
   exists specifically to drop a stale overload of `renew_contract_atomic`
   (**verified directly in this change** that this file exists and its name
   describes exactly that). Prefer keeping a function's parameter signature
   unchanged and casting internally, or explicitly `DROP FUNCTION` the old
   signature first if the signature must change.

3. **`contracts.tenant_id` resolves through `people`, not `tenants`.** —
   **Previously verified**, per the comment in
   `supabase/migrations/20260706025554_fix_rpt_tenant_statement_contract_id_and_tenants_table.sql`,
   which states the constraint name `contracts_tenant_id_people_app_fkey →
   people(id)` (**verified directly in this change**: this exact string
   appears in that file). The `tenants` table (documented elsewhere as
   holding live rows, still without its own migration file as of the last
   `docs/CURRENT_STATE.md` pass) has no FK relationship to `contracts` per
   the same source and should not be used for tenant lookups going forward.

4. **JWT role resolution reads `public.users.role`, not
   `public.profiles.role`.** — **Previously verified**: `custom_access_token_hook`
   was found reading the role claim from `public.profiles.role` (structurally
   capped at `ADMIN`/`USER` by a check constraint, so it could never resolve
   to `MANAGER`) instead of `public.users.role`. Fixed via
   `supabase/migrations/20260706014138_fix_custom_access_token_hook_role_source.sql`
   (**verified directly in this change**: file exists, defines
   `custom_access_token_hook`). Source: `docs/NEXT.md` → "Phase 0 Settings +
   Auth" (F0-6), `docs/PHASE_0_SETTINGS_AUTH_AUDIT.md`. Whether this fix is
   currently applied live was **not re-checked** in this pass — the file
   existing is not the same as it being deployed; see
   `docs/CURRENT_STATE.md` for the live-application status.

5. **RLS ownership checks on `sessions` are meant to compare `auth.uid()` to
   `sessions.user_id`, not `sessions.id`.** — **Previously verified**: the
   live `sessions_select_own`/`sessions_insert_own`/`sessions_delete_own`
   policies were found comparing against the row's own primary key
   (`sessions.id`), which is wrong; a fix exists at
   `supabase/migrations/20260705000004_fix_sessions_rls_user_id.sql`
   (**verified directly in this change**: file exists and defines these
   three policy names against `sessions.user_id`). Source:
   `docs/CURRENT_STATE.md`, `docs/GOVERNANCE_LOG.md`. Do not reintroduce a
   policy comparing against `sessions.id`.

6. **Route/UI permission gates are a UX layer, not the security boundary.**
   — **Inferred** from the shape of the code:
   `rentrix-app/src/features/auth/permissions.ts` defines
   `ADMIN`/`MANAGER`/`USER` roles and per-permission sets (**verified
   directly in this change**: `owners.hub.view`, `owners.detail.view`,
   `settings.manage`, `maintenance.view`, `audit.view`, `system.view` all
   appear in that file exactly as named); `route-guards.ts` reads these
   before rendering. Client-side route guards can be bypassed by anyone
   calling Supabase directly, so the actual authority is RLS plus the JWT
   role claim. Any new sensitive operation needs its own RLS policy
   verified live, not just a route-level permission check.

7. **`commissions` is an operational tracking feature, not a
   payout/accounting module.** — **Previously verified**: from navigation
   copy, UI, service layer, and the captured table shape. The table has an
   `expense_id uuid` column (**verified directly in this change**: this
   column appears in
   `supabase/migrations/20260705000002_baseline_capture_untracked_tables_batch_a.sql`,
   and a search of `rentrix-app/src/features/commissions/services/commissions-service.ts`
   and `types.ts` found zero references to `expense_id` — the frontend
   genuinely does not read or write it). Do not wire commissions into
   settlements, expenses, or ledger entries without a new design + migration
   + atomic RPC.

## Known current violations / active incidents

These are **not invariants** — they describe the system currently failing
to do what it should. Do not copy these into a "how the system works"
mental model; treat them as active bugs to check the status of before
building on the affected area.

- **Payments/receipts id linkage (voidReceipt).** `docs/CURRENT_STATE.md`
  documents (as of a 2026-07-06 pass) that `record_invoice_payment_atomic`
  wrote `payments.id` and `receipts.id` as two independently generated
  UUIDs with no linking column, causing every "void receipt" action to fail
  by design, not as an edge case. A later migration file,
  `supabase/migrations/20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql`,
  implements the "Option A" fix described there (shared id) — **verified
  directly in this change** that this file exists and its header states
  "Decision: Option A." **Not verified in this change**: whether this fix is
  applied to the live `nnggcnpcuomwfuupupwg` project, and whether
  `docs/CURRENT_STATE.md`'s "not yet fixed" wording (still present as of
  this pass) has been updated to reflect the file's existence. Anyone
  touching receipts/void logic must check both — a docs/agent-context pass
  is not a live-verification pass.

## Open assumptions and unknowns

- **Whether `contracts.id` / `people.id` are `text` or `uuid` live is
  contradictory across sources found in this repo, and was not resolved by
  this documentation pass.** The baseline schema file
  (`supabase/migrations/20250101000001_core_schema.sql`) declares
  `public.contracts.id uuid` and `public.people.id uuid`. But
  `supabase/migrations/20260706023440_fix_create_contract_atomic_tenant_id_type_mismatch.sql`
  states in its header "people.id is text," and
  `supabase/migrations/20260706022048_fix_renew_contract_atomic_payload_mismatch.sql`
  defines `renew_contract_atomic(old_contract_id text, ...)`, treating
  `contracts.id` as `text` — both **verified directly in this change** as
  file-level facts. `supabase/migrations/README.md` already warns the
  baseline file is "a reconstructed snapshot," not a literal replay, so the
  later fix-migration comments (which describe bugs found via live
  behavior) are more likely to reflect production reality — but this was
  **not confirmed by a live query** in this pass. Treat both as unconfirmed
  and check `information_schema.columns` on the live project before writing
  any code that depends on the answer.
- **Whether every financial void/delete leaves an accounting trace is not a
  confirmed project invariant.** No test or migration was found asserting
  this as a blanket rule during this pass. It may be a desirable policy, but
  agents must not treat it as an implemented guarantee — verify per-entity
  (e.g. does this specific void path write an audit-log row?) rather than
  assuming the pattern holds everywhere.
- **Security deposits, deferred revenue, multi-currency amounts** —
  **Previously verified as absent**: not found in migrations or
  `src/features` as of the last check cited in `docs/NEXT.md` → "Later".
  `Invoice`/`Expense`/`PaymentReceipt` all use a single unqualified `amount`
  number.
- **Bank reconciliation completeness** — **Previously verified partial**:
  foundation schema/UI, CSV paste import, and basic date/amount suggested
  matches exist. Bank-file upload/format mapping, duplicate detection, and
  advanced reconciliation rules are **Unknown/not built**. Source:
  `docs/NEXT.md`, `docs/CURRENT_STATE.md`.
- **Whether every RLS policy in `supabase/migrations/` matches what's live**
  — **Unknown by default**: migration files are not guaranteed to be a
  complete or accurate mirror of the live project (see
  `supabase/migrations/README.md`). Re-verify via `pg_policies` for any RLS
  policy you're about to rely on or change.
