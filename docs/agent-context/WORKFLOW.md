# Workflow — a task from start to finish

This file assumes you arrived here because `docs/agent-context/CONTEXT_MAP.md`
told you your task is non-trivial or high-risk. If you're not sure why
you're reading this, check the map — most tasks don't need it.

**Precedence, when-to-escalate, and scope-discipline rules live in
`AGENTS.md` and are canonical there — this file doesn't repeat them.** If
anything below seems to conflict with `AGENTS.md`, `AGENTS.md` wins.

## The sequence

1. **Explore.** Read what `docs/agent-context/CONTEXT_MAP.md` pointed you to
   for your task row — nothing more by default. Use `rg --files` / `rg
   <pattern>` instead of guessing paths.

2. **Confirm scope.** Restate, in the PR description or your own working
   notes, exactly what will change and what won't. If it turns out the task
   implies touching migrations, RLS, or production data beyond what was
   explicitly asked, see `AGENTS.md`'s "When to stop and ask" section before
   proceeding.

3. **Trace call sites and data flow.** For any function, RPC, or table
   you're changing, find every caller (`rg` for the function/table name
   across `rentrix-app/src` and `supabase/migrations`). Don't change shared
   behavior without checking who else depends on it today.

4. **Identify affected invariants.** Check the relevant section(s) of
   `docs/agent-context/DOMAIN.md` your task row pointed you to. If your
   change could affect a durable invariant, treat it as a test case, not
   just a reading exercise. If it touches something listed under "Known
   current violations," don't assume the described bug is still live or
   still unfixed — verify current state first.

5. **Implement the change the design actually requires.** Choose the
   smallest change that preserves domain invariants and data integrity. Do
   not avoid a migration, an RPC change, or a data migration merely to keep
   the diff smaller when the correct design requires one. Do not move
   database-integrity responsibilities into client code to avoid backend
   work.

6. **Run regression tests.** See `docs/TESTING.md` for exact commands. Run
   the narrowest relevant suite first, then the full sequence before
   finishing. Add `test:financials` for anything touching
   `features/financials/**` or money formatting/rounding logic, even if the
   change looks unrelated on the surface.

7. **Verify migration/live state when relevant.** If you touched a
   migration, RLS policy, or RPC: verify the live schema directly
   (`information_schema`, `pg_constraint`, `pg_policies`,
   `pg_get_functiondef`) rather than trusting the migration file or
   generated TypeScript types. Applying anything to production requires the
   sign-off `docs/GOVERNANCE.md` describes.

8. **Update documentation only when a documented fact actually changed.**
   Update `docs/CURRENT_STATE.md` if you changed something it describes, or
   add a decision record (`docs/decisions/README.md`) for a genuine
   architectural choice. Don't touch unrelated doc sections, and don't turn
   a small fix into a documentation rewrite.

## High-risk task types — extra rules

- **Migrations**: verify live schema before writing DDL, not just after
  (step 7 moved earlier). Filename must match
  `<14-digit-timestamp>_<snake_case_name>.sql`. A migration file existing in
  the repo is not proof it's applied live — `supabase/migrations/README.md`
  documents known drift between files and production.
- **RPCs**: check both sides of every `WHERE`/`JOIN` for `text`/`uuid`
  mismatches (`docs/agent-context/DOMAIN.md` → "Durable verified
  invariants," item 1). Check whether a parameter-type change would create
  a duplicate overload (item 2) — prefer casting internally instead of
  changing the signature.
- **RLS**: verify the live policy definition (`pg_policies` — `qual` and
  `with_check` aren't visible in `information_schema`), not just the
  migration file that supposedly created it. Confirm which column an
  ownership check actually compares against.
- **Financial calculations**: run `test:financials` regardless of how
  unrelated the change looks. Check `docs/agent-context/DOMAIN.md`'s
  "Known current violations" section for the current status of the
  payments/receipts linkage issue before touching anything nearby.
- **Destructive operations** (`DELETE`, `DROP`, dropping a column/type):
  confirm nothing live still references the target — function bodies,
  views, RLS expressions, composite types, not just a text/pattern search.
- **Production data / live Supabase mutations**: require explicit, specific
  product-owner sign-off before applying — see `docs/GOVERNANCE.md`. Log
  every applied mutation in `docs/GOVERNANCE_LOG.md`.

## Definition of success

- The diff is limited to what the task actually required.
- The relevant tests (per `docs/TESTING.md` and step 6 above) pass.
- Any live-state claim in the PR description is backed by an actual
  read-only check performed during this task, not an assumption carried
  over from a doc or a migration file.
- Documentation reflects the change only where a documented fact actually
  changed.
