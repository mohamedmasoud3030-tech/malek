# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Ready now

_Both items previously listed here — applying the 2 committed-but-unapplied migrations, and dropping the 9 orphaned enum types — were completed on production (`nnggcnpcuomwfuupupwg`) on 2026-07-05. See `docs/CURRENT_STATE.md` for details._

- Phase -1 shared-components implementation is complete: the custom `contract-card.tsx`, `property-card.tsx`, `unit-card.tsx`, and `receipt-card.tsx` components were replaced by `EntityCard` and deleted; `EntityForm` now unifies Root/Section/ErrorSummary/Actions/Overlay form behavior; `formatPropertyUnitSummary` moved to `features/properties/property-card-utils.ts`; receipt mobile cards and table badges now render the actual receipt status instead of a hard-coded posted label. Phase 0 (Settings + Auth) is the next required phase.
- Phase 0 Settings + Auth: live `information_schema`/`pg_policies`/`pg_get_functiondef(oid)` verification against production is now complete (via Supabase MCP, since direct network access from the sandbox container is blocked). F0-2, F0-3, F0-4 confirmed as no drift. F0-6 confirmed as a real drift — `custom_access_token_hook` read the JWT role claim from `public.profiles.role` (which structurally cannot be `MANAGER`) instead of `public.users.role` (the enum RLS already trusts) — and is now fixed on production via `20260706014138_fix_custom_access_token_hook_role_source.sql`, verified as a no-op for all current ADMIN users. See `docs/PHASE_0_SETTINGS_AUTH_AUDIT.md` for full detail. Remaining before Phase 0 closes: confirm `public.profiles.role` (still capped at ADMIN/USER by `profiles_role_check`) has no live authorization read path left, then document closure and move to Phase 1 (Financials).

## Needs investigation

- Commissions scope investigation is complete: `features/commissions/` is confirmed as an operational tracking view only, not a payout/accounting feature. See `docs/DOMAIN.md` for the documented assumptions and the inactive/placeholder `expense_id` note.
- Test-script glob/discovery review is complete: `rentrix-app/package.json` now lets Vitest discover colocated `*.test.ts(x)` / `*.spec.ts(x)` files automatically, so new tests no longer need manual registration in the main test script.

## Data correctness follow-ups

- Sessions RLS ownership is fixed and applied to production: `sessions_select_own`, `sessions_insert_own`, `sessions_delete_own` now compare `auth.uid()` to `sessions.user_id` instead of `sessions.id`. Live `pg_policies` verified post-apply. Closed.
- Date-only input defaults have been hardened away from `toISOString().slice(0, 10)` UTC slicing, including the financial expense-date flow; a regression test now scans production source files so future date-only values use local calendar parts instead.

## Later

- Bank reconciliation follow-up: foundation schema/UI plus CSV paste import and basic date/amount suggestions exist; add bank-file upload/format mapping, duplicate detection, advanced reconciliation rules, and production apply/verification.
- Security deposit management — not found in migrations or `src/features`.
- Deferred revenue handling — not found in migrations or `src/features`.
- Multi-currency support — not found in migrations or `src/features`; current `Invoice`/`Expense`/`PaymentReceipt` types use a single unqualified `amount` number.
