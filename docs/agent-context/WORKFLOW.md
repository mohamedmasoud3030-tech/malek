# Workflow — a task from start to finish

This is the sequence to follow for any non-trivial change. Skipping steps is
how the known bugs in `docs/CURRENT_STATE.md` (voidReceipt, text/uuid
mismatches, the profiles-role drift) happened.

1. **Explore.** Read `AGENTS.md`, then find your task in
   `docs/agent-context/CONTEXT_MAP.md` and read only the files it lists.
   Use `rg --files` / `rg <pattern>` instead of guessing paths.

2. **Confirm scope.** Restate, in your own head or in the PR description,
   exactly what will change and what won't. If the task description implies
   touching migrations, RLS, or production data and that wasn't explicitly
   asked for, stop and confirm before proceeding — see "When to stop and
   escalate" below.

3. **Trace call sites and data flow.** For any function, RPC, or table
   you're changing, find every caller (`rg` for the function/table name
   across `rentrix-app/src` and `supabase/migrations`). Do not change a
   shared function without checking who else depends on its current
   behavior.

4. **Identify affected invariants.** Check
   `docs/agent-context/DOMAIN.md`'s invariant list against what you're about
   to touch. If your change could affect one, treat that invariant as a test
   case, not just a reading exercise.

5. **Implement the smallest safe change.** Prefer the option that doesn't
   require a database migration, an RPC signature change, or a data
   migration, when a smaller option exists and covers the actual
   requirement. If a signature must change, see invariant 6 in
   `docs/agent-context/DOMAIN.md` (drop-and-recreate, or cast internally
   instead of changing the parameter type).

6. **Run regression tests.** See `docs/TESTING.md` for exact commands. At
   minimum: the narrowest relevant suite first, then the full sequence
   before finishing. Always add `test:financials` if you touched anything
   under `features/financials/**` or money formatting/rounding logic, even
   if the change looks unrelated on the surface.

7. **Verify migration/live state when relevant.** If you touched a
   migration, RLS policy, or RPC: verify the live schema directly
   (`information_schema`, `pg_constraint`, `pg_policies`,
   `pg_get_functiondef`) rather than trusting the migration file or
   generated TypeScript types. Do not apply anything to production without
   the sign-off `docs/GOVERNANCE.md` requires.

8. **Update documentation only when a documented fact changed.** Update
   `docs/CURRENT_STATE.md` if you changed something it describes, or add a
   decision record (`docs/decisions/README.md`) if you made an architectural
   choice worth remembering. Don't touch unrelated doc sections, and don't
   turn a small fix into a documentation rewrite.

## High-risk task types — extra rules

- **Migrations**: verify live schema first (step 7, but do it before writing
  DDL, not just after). Filename must match
  `<14-digit-timestamp>_<snake_case_name>.sql`. Never assume a migration file
  reflects live reality — `supabase/migrations/README.md` documents known
  drift.
- **RPCs**: check both sides of every `WHERE`/`JOIN` for `text`/`uuid`
  mismatches (invariant 5). Check whether a parameter-type change would
  create a duplicate overload (invariant 6) — prefer casting internally
  instead of changing the signature.
- **RLS**: verify the live policy definition (`pg_policies` — `qual` and
  `with_check` are not visible in `information_schema`), not just the
  migration file that (supposedly) created it. Confirm which column an
  ownership check actually compares (see invariant 8 for a past bug where a
  policy compared against the wrong column).
- **Financial calculations**: run `test:financials` regardless of how
  unrelated the change looks. Check invariants 1–3 in
  `docs/agent-context/DOMAIN.md`.
- **Destructive operations** (`DELETE`, `DROP`, dropping a column/type):
  confirm nothing live still references the target (function bodies, views,
  RLS expressions, composite types — not just a naive text/regex search, see
  the enum-type audit method described in `docs/CURRENT_STATE.md`).
- **Production data / live Supabase mutations**: require explicit, specific
  product-owner sign-off before applying — see `docs/GOVERNANCE.md`. This is
  enforced by CI (`scripts/check-production-mutation-guard.sh`), not just
  written guidance. Log every applied mutation in `docs/GOVERNANCE_LOG.md`.

## When to stop and escalate instead of assuming

- The task implies a production mutation that wasn't explicitly, specifically
  approved for this change.
- A migration file and the live schema disagree, and the task depends on
  which one is right.
- Fixing the task "properly" would require a broader refactor than what was
  asked (e.g. the voidReceipt bug needs an Option A/B product decision, not
  a quiet code fix — see `docs/CURRENT_STATE.md`).
- You can't find evidence for a business rule you'd otherwise have to guess
  at (don't invent one — say it's Unknown and ask).
- A change would touch a shared component, hook, or RPC used by more
  features than the task mentions.

## Definition of success

- The diff is limited to what the task required — no unrequested refactors,
  no unrelated file touches.
- The relevant tests (per `docs/TESTING.md` and this file's step 6) pass.
- Any live-state claim in the PR description is backed by an actual
  read-only check, not an assumption from a migration file or generated
  type.
- Documentation reflects the change only where a documented fact actually
  changed.

## Precedence rule

Documentation, including every file under `docs/agent-context/`, describes a
point-in-time understanding. When a doc and the actual code or live database
disagree, **the code and the live database are correct — not the doc.**
Fix the doc in the same PR when you find a mismatch; don't silently trust
the doc over what you've verified.
