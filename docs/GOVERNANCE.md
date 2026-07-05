# Governance

This file exists because a previous doc cleanup (PR #1040) removed the old
`SECURE_OPERATOR_RUNBOOK.md` / `RENTRIX_MASTER_PLAN.md` along with the
production-safety rules they carried, on the assumption they were stale
docs like everything else being deleted. They weren't just docs — they were
the only thing stopping an AI agent from mutating production without
sign-off. This file re-establishes that specific rule, and only that rule,
in a form short enough that it won't look like "legacy" clutter next time.

**Do not delete this file as part of a documentation cleanup.** If it looks
stale, verify the rule below no longer applies before removing it — don't
remove it because the file is old.

## The one rule that matters

**No AI agent (Claude, Codex, or any other) applies a mutation to the live
Supabase project (`nnggcnpcuomwfuupupwg`) without the product owner's
explicit sign-off on that specific change, given *before* it's applied.**

This covers: `apply_migration`, `execute_sql` with any `INSERT`/`UPDATE`/
`DELETE`/`ALTER`/`DROP`/`CREATE`, and any write through the Supabase REST/
JS client run against production rather than local tests.

It does **not** cover: read-only introspection (`information_schema`,
`pg_get_functiondef`, `list_migrations`, `SELECT`), local dev, or CI runs
against the test env vars already in `.github/workflows/ci.yml`.

"The product owner said 'clean this up' in general" is not sign-off for a
specific mutation. If a cleanup task turns out to require touching
production, stop and ask for that specific step before running it, even if
the broader task was already approved.

## Why this is enforced by CI, not just written down

A markdown rule an agent can delete in the same PR that violates it isn't a
rule. `scripts/check-production-mutation-guard.sh`, wired into
`.github/workflows/ci.yml`, fails the build if this file is missing or if
its "one rule" section is edited/removed without also touching
`docs/GOVERNANCE_LOG.md` (see below) — that pairing makes silent removal
show up as a CI failure instead of a quiet diff.

## Sign-off trail

Every production mutation, once approved and applied, gets one line
appended to `docs/GOVERNANCE_LOG.md`: date, who approved it, what was
applied, and the PR/commit it shipped in. This is intentionally a flat
append-only log, not a phase tracker or plan document — it's evidence of
consent, not a project-management artifact. It does not need "phases" or
"ADRs" to stay useful, and it shouldn't be extended into one.

## Everything else is not governed here

Module sequencing, UI conventions, ADRs, roadmap — none of that lives in
this file. Use `docs/CURRENT_STATE.md` and `docs/NEXT.md` for that, the way
the repo already works. This file has exactly one job.
