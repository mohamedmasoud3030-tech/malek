# Incident Response Runbook

> **Status:** OPERATIONAL — Phase 3 Operational Release Proof
> **Scope:** MALEK / rentrix-app

## Severity levels

| Level | Definition | Example |
|---|---|---|
| SEV-1 | Data integrity or money-safety failure; RC1 guard bypassed; wrong-company data exposure | Account 4000 credited with owner rent; cross-company data leak |
| SEV-2 | Full outage or broad functional failure, no data integrity loss | App down; auth broken for all users; deploy failed and rolled back automatically |
| SEV-3 | Partial/degraded functionality, workaround exists | One report broken; slow queries; non-critical route erroring |
| SEV-4 | Cosmetic or low-impact | UI glitch, non-blocking |

## Immediate response (first 15 minutes)

1. **Confirm the guard, not just the symptom.** For any suspected financial
   integrity issue, first check whether the relevant RC1 trigger/constraint
   actually fired or was bypassed — do not assume; query
   `pg_trigger.tgenabled` and re-run the specific guard behaviorally in a
   rolled-back transaction (see `BACKUP_RESTORE_RUNBOOK.md` for the pattern
   used to verify rules 1 and 5 live). A guard that silently stopped firing
   (e.g., disabled by a later migration) is itself the SEV-1.
2. **Freeze writes if data integrity is in question.** There is no
   application-level maintenance-mode flag in this codebase today (verified:
   no such flag found in `rentrix-app/src`). The fastest safe stop is
   pausing the Vercel deployment (`Vercel:pause_project` — returns 503 to
   all traffic) or revoking the affected RPC's `authenticated` EXECUTE grant
   directly via `REVOKE EXECUTE ... FROM authenticated` as an emergency
   `apply_migration`, which fails closed immediately without an app deploy.
3. **Do not attempt an undocumented hotfix against production.** Follow the
   existing `supabase-production-migrations.yml` gate (local-preflight →
   production-inspect → deploy) even under time pressure — it exists
   specifically to prevent a rushed, unreviewed emergency change from
   making things worse. Exception: role/grant `REVOKE` (not `GRANT`) is
   inherently safe to apply immediately because it can only remove
   capability, never add it.

## Diagnosis

4. Check `Supabase:get_advisors` (security + performance) for anything new
   since the last known-good baseline.
5. Check recent migrations via `Supabase:list_migrations` against the repo's
   `supabase/migrations/` — a mismatch here (as found during Phase 3, see
   `BACKUP_RESTORE_RUNBOOK.md`) means "what's live" and "what the ledger
   says is live" have diverged, which is itself worth ruling in/out as a
   contributing cause.
6. Check `Supabase:query_logs` for the incident window across
   `postgres_logs` and `edge_logs` sources.
7. For a suspected RC1 rule violation specifically, re-run the relevant
   guard test from this session as a template:
   - Rule 1 (owner rent isolation): attempt a non-master-lease credit to
     account 4000 inside `BEGIN; ... ROLLBACK;` and confirm error code
     `23514` with message prefix `RC1_4000_NON_MASTER_LEASE_CREDIT_BLOCKED`.
   - Rule 4 (commission type): confirm `commissions_type_check` still
     excludes `payment`.
   - Rule 5 (late fees): attempt a `LATE_FEE` `automation_jobs` insert
     inside `BEGIN; ... ROLLBACK;` and confirm error code `23514` with
     message prefix `RC1_LATE_FEE_JOB_FAIL_CLOSED`.

## Communication

8. Internal: notify product owner and accountant (per ADR 0016 authority
   list) immediately for any SEV-1/SEV-2. There is currently no automated
   paging/alerting system (see `MONITORING_AND_ALERTS.md` — this is a
   known, documented gap, not a hidden one).
9. External/customer: not applicable pre-pilot; this becomes a required
   step once G12 (one-office pilot) is active.

## Resolution and rollback

10. For a bad deploy: `Vercel` rollback to the last known-good production
    deployment SHA. Confirm the SHA against `RELEASE_EVIDENCE_LEDGER.md` or
    the most recent successful `hosted-staging-proof`/CI run for the prior
    release commit.
11. For a bad migration: **do not** attempt a manual `DROP`/`ALTER` to
    reverse it. Write a new forward migration that reverses the effect
    (matches the existing repo convention — see `WP-05` rollback notes in
    `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`:
    "reports are read-only; imports use atomic rollback; historical writes
    use new reversal/correction batches"). This preserves audit history.
12. For a guard bypass (SEV-1): after the immediate `REVOKE` stopgap, land
    a proper migration restoring/hardening the guard, verify it
    behaviorally (not just by reading the definition — actually attempt the
    violation in a rolled-back transaction), then restore the grant.

## Postmortem

13. Every SEV-1/SEV-2 gets a written postmortem: timeline, root cause,
    what guard (if any) should have caught it and why it didn't, and a
    tracked follow-up item. Store under `docs/operations/postmortems/`
    (create on first use).

## Known current gaps (honest state, not aspirational)

- No automated monitoring/alerting exists yet (see
  `MONITORING_AND_ALERTS.md`). Incident detection today is manual/reactive.
- No on-call rotation or paging tool is configured in this repository or
  known to this session. This is an external/organizational setup item.
- `auth_leaked_password_protection` is disabled on the live Supabase Auth
  config (confirmed via advisor scan 2026-08-25) — low severity but a real
  open item, fixable only via Supabase dashboard, not SQL.
