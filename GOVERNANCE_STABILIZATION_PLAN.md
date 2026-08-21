# MALEK Governance Stabilization Plan

Branch: `fix/canonical-governance-stabilization-20260822`
Base: `main` @ `97f1c79a74b4a6dca423b3fbd515a28235d56cdc`
Status date: 2026-08-22

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
- **Phase 2/3 — Canonical authority foundation + Auth Hook.** IN PROGRESS
  (this commit). New migration introducing:
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
- **Phase 4 — Sensitive RPC authorization.** NOT STARTED. Preserve real
  `preview_bank_statement_batch_atomic`, `import_bank_statement_batch_atomic`,
  `post_receipt_atomic` bodies; add/verify minimal authorization checks using
  the canonical resolver.
- **Phase 5 — SECURITY DEFINER boundary audit.** NOT STARTED.
- **Phase 6 — Guardian rule strengthening.** NOT STARTED. Import/adapt
  `scripts/guardian/` from PR #1543 as a starting point; strengthen
  `DG-GOV-008` to require a real permission-resolver call, not just
  authentication/scoping/validation presence.
- **Phase 7 — Executable role/company behavior tests.** NOT STARTED.
- **Phase 8 — Migration safety (clean + incremental replay).** NOT STARTED.
- **Phase 9 — Full local gate.** NOT STARTED.

## Non-negotiable rules carried through every phase

- `users.role` is never an operational authorization source.
- No silent fallback to `USER`/`VIEWER`/any role when authority is unproven.
- Real RPC implementations are preserved; no `_internal` phantom wrappers.
- Unrelated work/history on `main` and this branch is never reset or altered.
- Old migrations already merged into `main` are never edited; only new
  forward migrations are added.
