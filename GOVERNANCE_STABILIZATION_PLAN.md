# MALEK Governance Stabilization Plan

Branch: `fix/canonical-governance-stabilization-20260822`
Base: `main` @ `97f1c79a74b4a6dca423b3fbd515a28235d56cdc`
Status date: 2026-08-22 (updated after independent verification session)
Status: Phases 1–9 complete and independently re-verified. See "Regressions
found and fixed during independent verification" below for what an
earlier, unverified closure claim got wrong and how it was corrected.

This document is the working plan for bringing MALEK's authorization model in
line with the canonical authority chain:

```
user identity validity
  -> active company membership
    -> active company
      -> company_members.role
        -> governed permission resolver
          -> RLS / RPC / server enforcement
```

PR #1541 (`security/supabase-auth-rls-audit-20260821`) and PR #1543
(`arena/01a025d9-malek`, "Database Guardian V1") are reference material only.
Neither is merged into this branch. Their valid ideas are re-implemented here
correctly; their defects are not carried forward.

## Phase 1 findings (verified against live repository state)

1. **Stabilization branch was empty.** `fix/canonical-governance-stabilization-20260822`
   was identical to `main` (same SHA) with zero prior commits. This plan
   starts from a clean slate, not a continuation.

2. **The core defect exists on `main` itself, not just in the old PRs.**
   `public.custom_access_token_hook()` (in
   `supabase/migrations/20260901000000_canonical_baseline.sql`) derives
   `app_metadata.user_role` from `public.users.role`. It does not read
   `company_members.role` at all. It also falls back to `'USER'` via
   `coalesce()` when no role is found, and only checks `users.status =
   'ACTIVE'` for the role lookup (not `is_active`/`deleted_at` on that same
   query path).

3. **Every role helper on `main` has the same defect.** `current_app_role()`,
   `is_admin()`, `is_admin_or_manager()`, `is_accountant()`, `is_operations()`,
   `is_viewer()`, `is_app_user()` all read `public.users.role` directly. None
   of them reference `company_members` or check company activity. This means
   the entire permission system today is single-role-per-user, not
   membership/company scoped, contradicting the canonical model.

4. **`active_company_role()` does not exist anywhere** in `main` or either
   reference PR. It must be built new.

5. **`company_members.role` already enforces the correct six-role check
   constraint** (`ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER`) as of
   migrations `20260901000008` and `20260901000009`, already merged on `main`.
   The table is ready to be the authority source; nothing reads from it yet
   for permission decisions.

6. **PR #1541** hardens Auth Hook identity checks but its replacement hook
   (`..._harden_custom_access_token_hook_identity.sql`) still sources the role
   from `users.role`, not `company_members.role`. Reference only.

7. **PR #1543** moves in the right direction (a real Guardian tool at
   `scripts/guardian/`) but its migration
   `20260901000016_canonical_role_source.sql` **replaces the real, working
   implementations** of `preview_bank_statement_batch_atomic`,
   `import_bank_statement_batch_atomic`, and `post_receipt_atomic` with thin
   wrappers calling `preview_bank_statement_batch_internal`,
   `import_bank_statement_batch_internal`, and `post_receipt_atomic_internal`
   — **none of which are defined anywhere in the repository.** Merging this
   as-is would break bank import and receipt posting in production. This
   migration is not reused. The real implementations from `main` are the
   ones being preserved and hardened in Phase 4.

8. Guardian tooling (`scripts/guardian/`) does not exist on `main`. It exists
   only in PR #1543 and will be rebuilt/adapted, not blindly copied, since its
   rule `DG-GOV-008` is documented as too permissive (accepts company checks
   and `RAISE EXCEPTION` as proof of authorization).

## Phased execution plan

- **Phase 1 — State verification.** DONE. Findings above.
- **Phase 2/3 — Canonical authority foundation + Auth Hook.** VERIFIED
  COMPLETE. New migration `supabase/migrations/20260901000012_canonical_authority_foundation.sql`:
  - `active_company_role(uuid)` — the single canonical resolver. Validates
    user identity (`status='ACTIVE'`, `is_active`, `deleted_at IS NULL`),
    active membership, active company, and returns the `company_members.role`
    for that exact row. Returns `NULL` (never a default role) when any check
    fails.
  - Rewritten `current_app_role()` to call `active_company_role(current_company_id())`
    with no unsafe fallback.
  - Rewritten `is_admin()`, `is_admin_or_manager()`, `is_accountant()`,
    `is_operations()`, `is_viewer()`, `is_app_user()` to all route through the
    same resolver instead of querying `users.role` directly.
  - Rewritten `custom_access_token_hook()` so the JWT `user_role` claim is
    derived from `company_members.role` for the resolved active company, with
    the existing deterministic-fallback-company selection logic preserved
    (product already intentionally supports it), and no company/role claim
    emitted when authority cannot be proven (fail closed, per rule 9).

  **Verification evidence:**
  - Clean-database migration replay: `node scripts/db0/replay-migrations.mjs --all`
    → 13/13 migrations applied, 0 failures (includes the new migration).
  - New behavioral test `scripts/supabase-tests/canonical-authority-matrix.mjs`:
    20/20 assertions pass. Covers every scenario listed in the mission's
    Phase 3 test requirements: `users.role`/`company_members.role` conflicts
    in both directions (resolver and `is_admin()` follow membership, not
    `users.role`), inactive user, deleted user, inactive membership, inactive
    company, no-membership, and positive/negative coverage for all six role
    helpers via their matching `company_members.role`.
  - Existing `scripts/supabase-tests/rls-matrix.mjs`: 55 passed / 25 failed /
    1 skipped — **identical pass/fail count to `main`** (verified by running
    the same script unmodified against a `main` worktree). The 25 failures
    are pre-existing (a PGlite RESTRICTIVE-policy planner limitation
    affecting several SELECT-policy assertions, plus the `six_role_matrix`
    RPC test) and are out of scope for this phase per the mission's
    no-false-regression rule. One test (`auth.inactive_admin_not_manager`)
    initially showed as a new failure; root cause was the test harness's
    strict `String(actual) === String(expected)` comparison not treating
    SQL `NULL` (the new resolver's correct fail-closed return value) as
    equivalent to `false` for boolean predicates — fixed in
    `rls-matrix.mjs`'s `expectHelper` (NULL now normalizes to false only
    when the expectation itself is false), not by weakening the
    authorization logic. Confirmed no other test's pass/fail state changed.
- **Phase 4 — Sensitive RPC authorization.** VERIFIED COMPLETE (migrations
  `20260901000013`, `20260901000015`). Real `preview_bank_statement_batch_atomic`,
  `import_bank_statement_batch_atomic`, `post_receipt_atomic`,
  `execute_receipt_void_internal`, `record_invoice_payment_atomic`/`_engine`
  bodies preserved; authorization routed through the canonical resolver.
  `scripts/supabase-tests/sensitive-rpc-authorization-matrix.mjs`: 30/30.
- **Phase 5 — SECURITY DEFINER boundary audit.** VERIFIED COMPLETE
  (migration `20260901000016_security_definer_governance_hardening.sql`).
  Hardened `current_user_has_effective_app_permission`,
  `approve_receipt_void_atomic`, `request_receipt_void_atomic` (maker step —
  initially missed, added in a later commit on this branch, see below),
  `recalculate_all_balances`, `resolve_maintenance_with_expense`,
  `run_scheduled_automation_rules` (recognized as an already-closed disabled
  stub, not patched further), `request_permission`, and removed
  `current_user_has_support_capability`'s named MANAGER/ADMIN bypass.
  `scripts/supabase-tests/security-definer-boundary-audit.mjs`: 22/22.
  `scripts/supabase-tests/security-definer-governance-audit.mjs`: 28/28.
- **Phase 6 — Guardian rule strengthening.** VERIFIED COMPLETE.
  `scripts/guardian/` (`run.mjs`, `governance.mjs`, `governance-contract.json`)
  added fresh on this branch (not imported from PR #1543 — rebuilt against
  this branch's own resolver and audit scripts). `pnpm run db:guardian`:
  all 9 named layers pass (`db0-gate`, `canonical-authority`,
  `sensitive-rpc-auth`, `security-definer-governance`,
  `security-definer-boundary`, `strict-governance`,
  `governance-migration-safety`, `migration-hygiene`, `privileged-key-scan`).
- **Phase 7 — Executable role/company behavior tests.** VERIFIED COMPLETE.
  `canonical-authority-matrix.mjs` (20/20), `sensitive-rpc-authorization-matrix.mjs`
  (30/30), `security-definer-boundary-audit.mjs` (22/22),
  `security-definer-governance-audit.mjs` (28/28) — all four are new
  executable tests added by this branch, all green.
- **Phase 8 — Migration safety (clean + incremental replay).** VERIFIED
  COMPLETE. `scripts/supabase-tests/governance-migration-safety.mjs`: 8/8
  (unique versions, forward chain shape, clean replay, incremental replay
  on the pre-governance baseline, clean/incremental fingerprint parity,
  ledger correctness). Clean replay via
  `node scripts/db0/replay-migrations.mjs --all`: 18/18, 0 failures.
- **Phase 9 — Full local gate.** VERIFIED COMPLETE. `pnpm run db0:gate`:
  7/7. `pnpm run db:guardian`: all blocking layers pass. `pnpm run build`:
  succeeds (chunk-size warnings only, no errors). `pnpm run typecheck` /
  `pnpm run lint`: one pre-existing failure in
  `src/features/auth/effective-permissions.ts` (see "Verification against
  main" below) — proven identical on `main`, not introduced by this branch,
  out of scope for this stabilization effort.

## Regressions found and fixed during independent verification (2026-08-22)

An initial closure claim for this branch (from an earlier, unverified
session summary) reported all gates green. Re-running every gate from
scratch against the actual committed state found it was **not** green —
migration `00016` hard-failed clean replay, and Guardian reported 5
blocking layers, not a pass. Three real defects were found and fixed as a
result, each with its own commit:

1. **Migration `00016` clean-replay abort.** Its patch block for
   `run_scheduled_automation_rules()` searched for an authenticated
   ADMIN/MANAGER role-check fragment that migration `00006` (already on
   `main`) had already removed when it replaced the function with a
   disabled stub. Fixed by teaching the block to recognize the disabled
   stub + no-`authenticated`-EXECUTE-grant state as a valid secure
   terminal state instead of raising.
2. **Two real authority gaps**, found by actually running
   `security-definer-governance-audit.mjs` rather than trusting a prior
   claim of "28/28":
   - `request_receipt_void_atomic` (the maker step of the receipt-void
     maker/checker pair) still used raw `users.role IN ('ADMIN','MANAGER')`.
     Only the checker step (`approve_receipt_void_atomic`) had been
     hardened. Fixed with the same fragment-replace pattern used elsewhere
     in migration `00016`.
   - `record_invoice_payment_atomic_engine` (documented as "Internal RC1
     invoice collection engine. Not a browser RPC") was directly callable
     by `authenticated` due to a schema-wide
     `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO authenticated`
     in the baseline that an explicit `REVOKE ALL ... FROM PUBLIC` alone
     does not undo. Added an explicit `REVOKE ... FROM authenticated`.
3. **Real MANAGER support-access regression**, found by running the full
   frontend test suite and comparing every failure by name against a clean
   `main` worktree running the identical command. Migration `00016`'s SD-15
   hardening replaced `current_user_has_support_capability`'s named-role
   bypass with a routed call through `role_has_app_permission`, whose
   MANAGER whitelist had never been extended to include
   `support.operations.view` / `support.requests.triage` (permissions
   migration `00005` explicitly grants MANAGER). Fixed by adding both
   permissions to the MANAGER case in migration `00016`.

All three fixes are inside migration `00016`, which is new on this branch
and does not exist on `main` — confirmed via
`git show origin/main:supabase/migrations/20260901000016_...` (path does
not exist on `main`). Editing it is therefore not an edit to a historical/
shared migration; `scripts/check-migration-rollback-hygiene.test.mjs` and
the Guardian `migration-hygiene` layer both confirm this (`OK`, no
violation).

**Hosted/live-Supabase safety:** this session had no live Supabase (MCP)
access, so the claim that migration `00016` (or any migration `00012`–
`00017` in this branch) has never been applied to the hosted project
`nnggcnpcuomwfuupupwg` or any other shared environment could not be
independently re-verified here beyond documentary evidence (the migration
files exist only in this unmerged branch's `supabase/migrations/`
directory, `DATABASE_RULES.md`'s status table lives on this same unmerged
branch, and no CI/deploy artifact was found referencing them as applied).
Per standing instruction, this branch continues to treat `00016` as
branch-local and safe to edit directly for now, but **any further
correction after this point must be a new forward migration file**, not
another edit to `00016`, unless hosted non-application is re-confirmed via
live `supabase_migrations.schema_migrations` inspection in a session with
MCP access.

## Verification against `main` (full-suite classification)

Every failing test file across the entire frontend suite was run with the
identical `vitest` command against both this branch and a clean
`origin/main` worktree, and classified strictly by comparing failing test
names, assertion text, and error messages:

- **Pre-existing on `main`, unchanged by this branch:** all
  `permission-workflow.integration.test.ts` failures (stale
  `throughMigration` version, documented separately), `permissions.test.ts`
  regex self-match, `contract-evidence-authority.test.ts` (3 seed
  failures), `commissions-financial.test.ts`, `r4-contract-billing-authority-execution.test.ts`,
  `owner-agency-invoice-accounting.test.ts` (draft-contract fixture,
  matches `require_active_contract_before_invoice_posting` already on
  `main`), `authoritative-property-ownership-runtime.test.ts`,
  `p6e-contract-form-behavior.test.tsx`, `p4-settings-admin-cleanup.test.ts`,
  `units-list*.test.tsx`, `reports/phase7-reports.test.tsx`,
  `system/platform-security-contract.test.ts`,
  `supabase-data-visibility/critical-page-states.test.ts`, every file under
  `src/app`, `src/components`, `src/hooks`, `src/lib` that failed (design/
  brand/touch-target/PWA contract tests), and the
  `effective-permissions.ts` TS2345 typecheck error. Every one of these
  matched `main` exactly by file, test name, and error text.
- **Real regressions found and fixed:** `admin-support-operations.test.ts`
  (2 of 4 tests — see item 3 above). After the fix: 4/4 on this branch,
  matching `main`'s 4/4.
- **New tests added by this branch, all passing:**
  `canonical-authority-matrix.mjs`, `sensitive-rpc-authorization-matrix.mjs`,
  `security-definer-boundary-audit.mjs`,
  `security-definer-governance-audit.mjs`, `governance-migration-safety.mjs`.


## Non-negotiable rules carried through every phase

- `users.role` is never an operational authorization source.
- No silent fallback to `USER`/`VIEWER`/any role when authority is unproven.
- Real RPC implementations are preserved; no `_internal` phantom wrappers.
- Unrelated work/history on `main` and this branch is never reset or altered.
- Old migrations already merged into `main` are never edited; only new
  forward migrations are added.
