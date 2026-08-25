# MALEK Phase 3 — Operational Release Proof: Final Report

**Date:** 2026-08-25
**Repository state verified:** `main@8f16d2ae044a685074a4eee146b601ab6b04d351` (PR #1572 merged)
**Live database verified:** Supabase project `nnggcnpcuomwfuupupwg`
**Method:** Direct repo clone, direct SQL against the live project (behavioral
proofs run inside `BEGIN; ... ROLLBACK;`, zero data mutated), direct GitHub
API inspection of PR #1572's CI checks.

---

## Requirement-by-requirement status

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Real backup + restore to a rehearsal environment | **PARTIAL / human sign-off required** | Non-destructive rehearsal method identified (`create_branch`); requires human approval of ~$0.01344/hr cost before execution — not run this session. Schema-level recovery already proven separately via clean PGlite replay of all 38 migrations. |
| 2 | Measured recovery time (RTO) | **BLOCKED — external** | Cannot measure without either the branch rehearsal (needs cost approval) or dashboard-driven PITR restore (needs Supabase dashboard access this session doesn't have). Documented in `BACKUP_RESTORE_RUNBOOK.md`. |
| 3 | Release rollback + config recovery proof | **PASS with a documented pre-condition** | The existing `supabase-production-migrations.yml` gate (local-preflight → production-inspect → deploy, requiring backup+rollback references) is real and sound. **Genuine finding:** the live migration ledger is missing 16 entries whose effects are actually present (verified live). Functionally correct, but the ledger itself is not currently trustworthy for a from-scratch rebuild. Added `verify-migration-ledger-parity.sh` + scheduled CI check so this is now detected automatically rather than silent. Repair procedure documented, not executed (requires `supabase migration repair` with credentials this session doesn't have — explicitly NOT hand-patched, per instruction). |
| 4 | Secrets and production-config checklists | **PASS** | No hardcoded secrets in tracked source (verified by grep). `.gitignore` correctly excludes all `.env*` except placeholder `.example` templates (verified). Existing `supabase-client-boundary.test.ts` — a real test that fails the build if `SERVICE_ROLE`/`sb_secret_` leaks into client code — **executed live: 3/3 PASS**. `.env.qa.example` correctly documents required variables without real values. |
| 5 | Monitoring | **PARTIAL** | No monitoring/alerting existed before this pass (verified — zero references to any monitoring vendor in the entire repo). Added a scheduled (daily cron) extension to the existing read-only live-readiness workflow, plus a new migration-ledger-parity check. This is a real, working, zero-new-cost first layer — not equivalent to production-grade alerting/paging, which is explicitly flagged as a pre-pilot (not pre-Phase-3) external decision in `MONITORING_AND_ALERTS.md`. |
| 6 | Alerts | **PARTIAL — same evidence as #5** | A failed scheduled workflow run shows red in the GitHub Actions tab; nothing pages a human. Real paging (PagerDuty/Opsgenie/Slack webhook) is flagged as an explicit external/product decision, not fabricated as "done." |
| 7 | Incident procedure | **PASS** | `INCIDENT_RESPONSE_RUNBOOK.md` written: severity levels, immediate-response steps including the actual RC1 guard re-verification pattern used and proven in this session, diagnosis steps tied to real available tools (`get_advisors`, `query_logs`), rollback guidance consistent with the repo's existing forward-only correction convention, and an honest "known current gaps" section (no paging, no on-call rotation). |
| 8 | Legal/tax/accounting review | **PARTIAL — technical readiness PASS, professional approval external** | Confirmed via live SQL: RC1 rule enforcement for owner-rent isolation (rule 1) and commission-type restriction (rule 4) is live and behaviorally verified. `s08_*`/`s09_*` historical-correction machinery exists but has zero rows — correctly unused, matching "no historical correction without approval." ADR 0016 (`docs/decisions/0016-closeout-external-decision-packets.md`) already correctly documents that Oman legal template review and statutory tax-code confirmation are external, named-authority decisions — not fabricated as complete here. |
| 9 | One-office pilot | **NOT STARTED — correctly, per your instruction** | Confirmed live: only 2 companies, 3 contracts, 1 payment, 6 journal lines in the database — consistent with a demo/pre-production system with no real customer data. No pilot claimed. G12 is genuinely not startable without a real office and real operating data. |
| 10 | Reconciliation | **PASS (synthetic/structural) / PARTIAL (live cycle)** | `S08 subledger_gl_reconciliation` and related tables exist and are structurally sound (per governing doc: RC1 synthetic path proves 1201/1300/2000/2200/2300 at 0.000). No live reconciled operating period exists yet because there is no pilot data — this is the correct, non-fabricated state, not a gap Phase 3 could close without #9. |
| 11 | S08 decision | **NOT STARTED — confirmed by direct query** | `select * from s08_frozen_reviews` → **zero rows**, live. The S08 freeze/approval RPCs (`s08_create_frozen_review`, `s08_approve_frozen_review`, `s08_analyze_frozen_review`, `s08_verify_fingerprint`, `s08_reject_frozen_review`) exist and are deployed, but no review has ever been created. This matches the governing document's own `S08 NOT_STARTED` status exactly — confirmed independently, not just cited. |
| 12 | G13 final release decision | **NO-GO for full production; documented path to GO for a controlled pilot start** | See verdict below. |

---

## Genuine findings from this pass (not pre-existing knowledge)

1. **`hosted-staging-proof` failed on the PR #1572 merge commit** (confirmed via GitHub Checks API) — consistent with G11 being unproven, not a new regression, but worth naming precisely: it needs `E2E_STAGING_BASE_URL`/`E2E_SUPABASE_URL` secrets pointing at a real hosted staging environment, which does not appear to exist yet.
2. **Migration ledger drift** (described above) — the most significant technical finding. Live schema is correct; the record of *how it got that way* is incomplete. This is exactly the kind of gap that operational-release-proof work exists to catch, and it was previously invisible because nothing checked it automatically. Now it is checked automatically (`verify-migration-ledger-parity.sh` on a daily schedule).
3. **`auth_leaked_password_protection` disabled** on live Supabase Auth — real, low-effort, dashboard-only fix; flagged, not fixed (no dashboard access this session).
4. **No GitHub write access from this session** — I could not open the PR containing this work. All artifacts are staged as downloadable files instead; see below.
5. Two stale project-ID references were found and corrected during this engagement: the correct live project ID is `nnggcnpcuomwfuupupwg`, not the ID recorded in earlier memory (`nnggcnpcuomwg`, which is malformed/incomplete) or the ID string that appeared to originally match in one older doc.

## Artifacts produced this session (staged, not yet merged — see blocker below)

- `docs/operations/BACKUP_RESTORE_RUNBOOK.md`
- `docs/operations/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/operations/MONITORING_AND_ALERTS.md`
- `scripts/verify-migration-ledger-parity.sh`
- Extension to `.github/workflows/supabase-live-readiness.yml` (added `schedule:` trigger + ledger-parity step)

## Genuine external/human blockers (not fabricated, not worked around)

1. **GitHub write access** — the connector returned `403 Resource not accessible by integration` when creating a branch. A human with push access needs to land these five files; I cannot open the PR myself this session.
2. **Backup/restore rehearsal cost approval** — ~$0.01344/hr Supabase branch cost needs explicit human confirmation (and the organization ID used for the quote should be re-verified in the dashboard — it was inferred, not confirmed).
3. **Migration ledger repair** — needs `SUPABASE_ACCESS_TOKEN` + DB password to run `supabase migration repair` safely; not available this session, and correctly not hand-patched per your explicit instruction.
4. **`auth_leaked_password_protection`** — Supabase dashboard-only toggle.
5. **Real alerting/paging vendor and error-tracking SDK selection** — product-owner decision involving new third-party accounts and data-handling choices.
6. **Hosted staging environment** — `hosted-staging-proof` needs real secrets for a real staging deployment that does not appear to exist.
7. **Legal (Oman) template review and statutory tax-code confirmation** — named-authority items per ADR 0016, correctly still external.
8. **One-office pilot and its reconciliation** — cannot exist without a real office; correctly not started, not simulated.

---

## Final Production GO/NO-GO Verdict

**NO-GO for full production launch. GO for the next controlled step — landing this Phase 3 work and running the backup rehearsal — is achievable now, pending the two approvals above.**

Reasoning: the core RC1 financial-safety engineering is real and verified live
(guards behaviorally proven, not just read). But three structural blockers
are still open through no fault of the engineering: (a) I have no write
access to land any of this work, (b) the backup/restore rehearsal — the
literal subject of item #1 — has not actually been executed, only planned
and costed, and (c) the migration ledger integrity gap is a genuine
rollback-safety risk that must be repaired with real credentials before G11
can honestly read PASS. None of these are things I can complete by writing
more documentation; they require a human with GitHub push access, Supabase
dashboard/CLI credentials, and authority to approve a small recurring spend.

**What "GO" looks like next, concretely:**
1. A human with repo write access opens a PR from the five staged files (or I retry once access is granted).
2. You (or an authorized operator) approve the ~$0.01344/hr branch cost; I run the rehearsal and report a real RTO number.
3. An operator with Supabase CLI credentials runs `supabase migration repair` per the documented procedure and re-confirms `db push --dry-run` reports zero pending migrations.
4. Toggle leaked-password protection on in the Supabase Auth dashboard.

None of these require new engineering — they require access I don't have in this session.
