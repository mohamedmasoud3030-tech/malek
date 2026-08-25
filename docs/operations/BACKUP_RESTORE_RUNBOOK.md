# Backup, Restore and Recovery-Time Runbook

> **Status:** OPERATIONAL — Phase 3 Operational Release Proof
> **Scope:** MALEK / rentrix-app, Supabase project `nnggcnpcuomwfuupupwg`
> **Last verified:** 2026-08-25 (see Evidence section)

## Purpose

This runbook defines how to prove and execute backup/restore for MALEK, and
records the actual measured evidence gathered against the real project. It
does not claim a restore rehearsal happened until the Evidence section below
is filled in with a real run.

## Backup mechanism (platform-provided)

Supabase provisions automatic daily physical backups and Point-in-Time
Recovery (PITR) for paid-tier projects, managed entirely by the platform.
There is no application-level backup job in this repository to maintain —
the release-relevant work is: (1) confirming the project's backup/PITR tier
and retention window, (2) rehearsing a restore into a non-production target,
and (3) measuring how long that takes end to end.

**Operator action required (external):** confirm in the Supabase dashboard
(Project Settings → Database → Backups) which tier applies to
`nnggcnpcuomwfuupupwg` and what the retention window is. This cannot be
read via SQL or the MCP tools available to this session — it is a billing/
project-settings property, not a database property.

## Non-destructive rehearsal method (recommended, used here)

Rather than restoring over the only live project — which is unnecessary
risk even on a demo/pre-production system — use `create_branch` (Supabase
branching) as the rehearsal target:

1. A branch provisions a fresh database and replays the **full migration
   history** from `supabase/migrations/` against it. This is a structurally
   different but operationally equivalent proof to a PITR restore: it
   proves the schema can be rebuilt from scratch, end to end, without
   human intervention beyond triggering it.
2. Time from "create branch requested" to "branch database reachable and
   migration-complete" is the schema-recovery RTO component.
3. Data-recovery RTO (restoring actual rows from a backup snapshot) is a
   separate, platform-managed operation and must be rehearsed with the
   Supabase dashboard's "Restore" flow against a project, which requires
   dashboard access this session does not have.

**Cost note:** creating a branch is a real billed resource
(~$0.01344/hour at time of writing, confirmed via `get_cost`). This
requires explicit human approval before creation — flagged separately,
not executed automatically by an agent.

## RTO measurement methodology

| Component | Method | Status |
|---|---|---|
| Schema recovery (migrations replay) | `create_branch` timing, start-to-ready | **Pending — awaiting cost approval, see below** |
| Data recovery (PITR/backup restore) | Supabase dashboard Restore flow, timed manually by operator | **External — requires dashboard access** |
| Application recovery (Vercel redeploy to known-good SHA) | `vercel rollback` or redeploy timing | **External — requires Vercel deployment history access beyond this session's project linkage** |
| DNS/traffic cutover | N/A for current single-environment setup | Not applicable at current scale |

## Evidence

**Schema-recovery rehearsal:** NOT YET EXECUTED this session. A cost
confirmation (~$0.01344/hr) is required before `create_branch` can run
against project `nnggcnpcuomwfuupupwg`, and the organization ID used for
the cost lookup was inferred rather than confirmed, so the quoted figure
should be re-verified in the dashboard before approving. This is a
genuine external/human checkpoint, not an oversight.

**What is proven without spend:** the migration chain itself replays
cleanly — this was independently verified earlier in this engagement via
PGlite local replay of all 38 repository migration files with zero
failures. That proves the *migrations are individually valid and ordered
correctly*. It does not prove wall-clock RTO on real Supabase
infrastructure, which requires the branch (or a real restore) to run.

**Migration ledger integrity (rollback-relevant finding):** `supabase_migrations.schema_migrations`
on the live project is missing tracking rows for 16 migrations
(`20260901000019` through `20260901000034`) whose effects are verifiably
present in the live schema (confirmed by direct inspection of live
constraints, triggers, function bodies, and column types — see
`RELEASE_EVIDENCE_LEDGER.md` and the Phase 3 sign-off record). This means:

- The database is **functionally correct** — behavior matches what those
  migrations specify.
- The **migration ledger is not a trustworthy source of truth** for what
  has been applied. A future `supabase db push` or disaster-recovery
  replay against a *clean* database, using only the tracked ledger, would
  not reproduce the current live schema faithfully, because 16 real
  schema changes are undocumented in that ledger.
- This is a real rollback/config-recovery risk: anyone reconstructing
  production from "migrations the ledger says are applied" would get a
  different (older, less secure) schema than what is actually running.

**Required remediation (not performed here per explicit instruction):**
do not hand-edit `schema_migrations` without a documented, reversible,
proven-safe procedure. The safe path is: (1) diff each of the 16 "missing"
migration files against live schema objects one-by-one (partially done
here for constraints/triggers/functions/columns — full line-by-line diff
still needed), (2) for any migration whose file content exactly matches
live state, mark it applied through Supabase's own migration-repair
tooling (`supabase migration repair`) rather than raw SQL, which is
designed exactly for this reconciliation case, and (3) re-run
`supabase db push --dry-run` afterward and confirm it reports zero pending
migrations. This is flagged as **required before G11 can PASS**, and is
listed as a human/operator action because it needs `SUPABASE_ACCESS_TOKEN`
and DB password credentials this session does not have.

## Rollback/config recovery — release migration path

The repository already has a real, well-built gate for this
(`.github/workflows/supabase-production-migrations.yml`): a three-stage
`local-preflight` → `production-inspect` → `deploy` workflow that requires
a backup reference and rollback plan string before any production
migration apply, re-diffs the migration plan immediately before applying,
and refuses to run if the plan changed since inspection. This is real,
existing, good engineering — not something Phase 3 needed to invent.

**What Phase 3 adds:** the finding above means that if this workflow's
`production-inspect` step were run today, it would report 16 "missing"
migrations that are not actually missing in effect. Running `deploy`
without first resolving the ledger gap would likely fail outright
(duplicate constraint/object errors) — which is a safe failure — or, in
a worse case depending on migration idempotency, could partially apply.
**Recommendation: do not run the `deploy` action of that workflow until
the migration ledger is repaired per the remediation steps above.** This
is now a documented, explicit pre-condition, not a silent trap.

## Config recovery (non-database)

- Environment/secrets: `.env.qa.example` documents every required variable
  name and purpose; no production `.env` is tracked (confirmed via
  `git ls-files`). Recovery of a lost secret requires re-issuing it from
  Supabase/Vercel dashboards — there is no local copy to restore from,
  by design.
- Application config (Vercel project settings, environment variables):
  external to this repository; recovery requires Vercel dashboard access
  or the Vercel API with a token, neither available this session.

## Sign-off

This runbook is a real, usable procedure. The **RTO numbers section is
intentionally incomplete** pending either (a) explicit approval to spend
the ~$0.01/hr branch cost and run the rehearsal, or (b) operator-run
dashboard restore timing. Do not report an RTO figure without one of
these two having actually happened.
