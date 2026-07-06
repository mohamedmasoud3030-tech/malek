# Phase 0 Settings + Auth Audit

Date: 2026-07-05
Scope: read-only audit for `rentrix-app/src/features/settings/**` and `rentrix-app/src/features/auth/**` before any Phase 0 implementation.

## Governance and production safety

- `docs/GOVERNANCE.md` was re-read before continuing into Phase 0.
- No production mutation was required or performed.
- Live Supabase verification is required before Phase 0 implementation. Attempted read-only REST access to `nnggcnpcuomwfuupupwg` from this container failed with `ENETUNREACH`, so the live `information_schema` / `pg_get_functiondef(oid)` portion is not complete in this environment.
- Because the required live verification is blocked, this report is a code-and-migration audit plus a concrete live-verification checklist. Do not implement Phase 0 fixes until the live verification rows below are filled in from an operator environment with database access.

## Code audit summary

### Settings services

- `companySettingsService.ts` reads `company_settings` with `.select('*').limit(1).maybeSingle()` and updates the currently loaded row by `id`; no RPC is used.
- `costCenterService.ts` reads, creates, updates, and soft-archives rows in `cost_centers`; no RPC is used.
- `paymentTermsService.ts` reads, creates, updates, and soft-archives rows in `payment_terms_templates`; no RPC is used.
- The settings page includes company profile, identity/printing, document prefixes, cost centers, payment terms, notifications, security/account, role simulator, and system/data sections.

### Auth and route guards

- `permissions.ts` is pure TypeScript authorization logic. It does not call Supabase directly.
- Roles are `ADMIN`, `MANAGER`, and `USER`; `settings.manage` is granted to `ADMIN` and `MANAGER`, not `USER`.
- `route-guards.ts` denies permission-gated routes by redirecting to `/` when `canAccess(...)` fails.
- `routeTree.ts` gates `/settings` with `settings.manage`, and `/change-password` with `auth.password.change`.

## Migration-file audit summary

Local migration files define or adjust the Phase 0 tables/functions as follows:

- `company_settings` is created in `20250101000001_core_schema.sql` with singleton semantics and core company identity/formatting fields.
- VAT settings are added by `20260628000200_add_vat_support.sql`.
- `contract_prefix` and `default_vat_rate` are guarded by `20260628000500_fix_company_settings_missing_columns_and_invoice_tax_default.sql`.
- Notification columns are guarded by `20260628000600_fix_company_settings_notification_columns.sql`.
- `cost_centers` is created by `20260628000100_add_cost_centers.sql`, linked to `expenses` and `journal_entries`, and protected by authenticated-user read plus admin/manager manage policies.
- `payment_terms_templates` is created by `20260628000300_add_payment_terms.sql`, linked to `contracts.payment_terms_id`, and protected by authenticated-user read plus admin/manager manage policies.
- `custom_access_token_hook(jsonb)` in `20250101000003_functions_triggers_and_rpcs.sql` copies `public.users.role` into `app_metadata.user_role` for frontend permission checks.

## Findings requiring review before implementation

### F0-1 — Live schema/RPC verification is blocked from this container

Required Phase 0 verification explicitly includes live `information_schema` and `pg_get_functiondef(oid)` checks. Network access from this container to `https://nnggcnpcuomwfuupupwg.supabase.co` failed with `ENETUNREACH`, so this audit cannot honestly claim live parity.

Required operator-side read-only checks are also packaged in `scripts/collect-phase0-settings-auth-evidence.sh`. The raw SQL is:

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('company_settings', 'cost_centers', 'payment_terms_templates', 'users')
order by table_name, ordinal_position;

select table_name, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and table_name in ('company_settings', 'cost_centers', 'payment_terms_templates', 'users')
order by table_name, policyname;

select p.proname, pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('custom_access_token_hook', 'is_app_user', 'is_admin_or_manager', 'update_updated_at', 'touch_updated_at')
order by p.proname;
```

### F0-2 — `company_settings` read/update has no frontend permission guard in the service layer

The `/settings` route is permission-gated, but `getCompanySettings()` and `updateCompanySettings()` themselves trust database RLS/service errors. This is acceptable only if live RLS on `company_settings` restricts writes to admin/manager. Confirm live policies before implementation. If live RLS is broad, the fix should be backend/RLS plus a small frontend authorization guard.

### F0-3 — `cost_centers` and `payment_terms_templates` rely on admin/manager RLS for write safety

The service functions expose insert/update/soft-archive operations directly from the frontend. Local migrations intend `authenticated` read for app users and admin/manager writes. Confirm live policies match those migrations exactly before implementation.

### F0-4 — Payment-term interval vocabulary must be checked against financial/contract expectations

`paymentTermsService.ts` supports `monthly`, `quarterly`, `biannual`, `annual`, and `custom`, matching the local `payment_terms_templates.interval_type` migration. Contract payment cycles elsewhere use `monthly`, `quarterly`, `semi_annual`, and `annual`. This may be intentional because terms templates are not contract cycles, but it should be confirmed before Phase 0 closes to avoid silently mixing `biannual` and `semi_annual` meanings in financial workflows.

### F0-5 — Authorization role source depends on the live custom access-token hook

Frontend permissions resolve `app_metadata.user_role` first, then `app_metadata.role`. The migration-defined hook populates `app_metadata.user_role` from `public.users.role`. Phase 0 cannot be closed until `pg_get_functiondef(oid)` confirms the live hook body still does this, and until a live or test auth token confirms the claim appears as expected.

### F0-6 — Profiles role constraint differs from canonical app roles in captured baseline

The captured `profiles` baseline allows only `ADMIN` and `USER`, while frontend authorization recognizes `ADMIN`, `MANAGER`, and `USER`. This is outside the direct settings/auth files unless profiles are used for auth in live flows, but Phase 0 should explicitly verify whether `profiles.role` participates in authorization or is legacy/inactive. If active, the missing `MANAGER` value is a schema/auth drift finding.

## Operator evidence script

Run this from an operator environment with `psql` and `SUPABASE_DB_URL` available:

```bash
scripts/collect-phase0-settings-auth-evidence.sh
```

The script runs only `SELECT` statements against `information_schema`, `pg_policies`, `pg_proc`/`pg_get_functiondef(oid)`, and `supabase_migrations.schema_migrations`. It does not execute DDL/DML and does not mutate production.

## Implementation recommendation after live verification

If the live schema and function checks match local migrations:

1. Keep Phase 0 implementation frontend-only unless tests expose a concrete bug.
2. Add targeted tests for any confirmed vocabulary or permission edge cases.
3. Document the live verification evidence in `docs/NEXT.md` or `docs/CURRENT_STATE.md` when Phase 0 closes.

If live checks differ from migrations:

1. Stop before any production mutation.
2. Record the exact drift in `docs/NEXT.md`.
3. Ask Muhammad for explicit approval for each required production SQL/migration step before executing it.

## Local regression coverage

`rentrix-app/src/features/settings/phase0-settings-auth-audit.test.ts` locks the local Phase 0 audit invariants that can be verified without production access: settings services remain RPC-free, `settings.manage` stays limited to admin/manager frontend roles, payment-term interval values stay aligned with the local migration check constraint, and the operator evidence script remains read-only.

## Live verification results (completed 2026-07-06, via Claude + Supabase MCP)

The live checks blocked in this container (`ENETUNREACH`) were completed from
an operator environment with direct Supabase MCP access to
`nnggcnpcuomwfuupupwg`. Results:

- **`company_settings`, `cost_centers`, `payment_terms_templates` columns**:
  match the local migrations exactly (VAT fields, `contract_prefix`,
  `default_vat_rate`, notification columns, soft-delete columns all present
  as expected). No drift found.
- **RLS policies** on `company_settings`, `cost_centers`,
  `payment_terms_templates`, `users`: match the code's assumptions exactly.
  `is_admin_or_manager()` and `is_app_user()` gate writes/reads as the
  service layer expects. **F0-2 and F0-3 are closed — no drift.**
- **`payment_terms_templates.interval_type`**: local migration and live
  schema agree (`monthly`, `quarterly`, `biannual`, `annual`, `custom`).
  This is a separate vocabulary from contract payment cycles
  (`semi_annual` vs `biannual`) by design, not drift — **F0-4 confirmed as
  intentional, no fix required**, but worth a one-line note in
  `docs/DOMAIN.md` if not already there so it isn't re-flagged later.
- **F0-5 / F0-6 — confirmed as a real drift, now fixed:**
  - `app_private.is_admin_or_manager()` and `app_private.is_app_user()` (the
    functions actually enforcing RLS) read role from **`public.users.role`**
    — a proper enum (`ADMIN`, `MANAGER`, `USER`).
  - `custom_access_token_hook` (which populates the JWT
    `app_metadata.user_role` claim the frontend's `permissions.ts` reads)
    instead read from **`public.profiles.role`** — a plain `text` column
    with `CHECK (role = ANY (ARRAY['ADMIN','USER']))`. `MANAGER` was
    structurally impossible in `profiles`.
  - Net effect: RLS could correctly authorize a MANAGER at the database
    layer, but the frontend could never see a MANAGER claim in the token,
    so a MANAGER user would silently behave as USER in the UI (missing
    `settings.manage` and other manager-only permissions) despite RLS being
    willing to allow it.
  - **Fix applied to production** (migration
    `20260706014138_fix_custom_access_token_hook_role_source.sql`):
    `custom_access_token_hook` now reads role from `public.users.role`
    (filtered to `status = 'ACTIVE'`, falling back to `'USER'` for
    inactive/missing users) instead of `public.profiles.role`. This makes
    `public.users` the single source of truth for both RLS and the JWT
    claim.
  - **Verified no-op for all current sessions**: every existing row in both
    `users` and `profiles` is `role = 'ADMIN'` today, and the hook was
    tested directly against a real user id post-change, confirming
    `app_metadata.user_role` still resolves to `"ADMIN"`. The fallback path
    was also tested against a non-existent user id and correctly resolves
    to `"USER"`.
  - Approved and applied per `docs/GOVERNANCE.md` sign-off; recorded in
    `docs/GOVERNANCE_LOG.md`.
  - **Follow-up confirmed closed**: a repo-wide search of
    `rentrix-app/src` found zero references to a `profiles` table anywhere
    in application code (`grep -rn "from('profiles')"` and role/permission
    combinations both return nothing). `public.profiles` had no live
    frontend authorization read path even before this fix — its only
    effect on authorization was through `custom_access_token_hook`, which
    is now fixed. No further action needed on `profiles.role` for Phase 0.

## Phase 0 status

Phase 0 findings are now fully resolved: F0-1 (live verification) is
complete, F0-2/F0-3/F0-4 confirmed as no drift, F0-5/F0-6 confirmed as real
drift and fixed and verified on production, and the `profiles.role`
follow-up is confirmed closed (no live authorization read path exists).
No frontend/backend code changes beyond the `custom_access_token_hook` SQL
fix are required — the settings/auth service layer and permission logic
already matched live schema and RLS. Phase 0 is **ready to close**: run
regression tests + typecheck + build once more against this state, then
document closure in `docs/NEXT.md` and move to Phase 1 (Financials).

