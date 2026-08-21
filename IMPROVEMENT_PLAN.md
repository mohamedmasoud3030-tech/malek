# MALEK Improvement Plan

Status: ACTIVE  
Baseline branch: `main`  
Baseline SHA: `b1bb5a901b7adff1aa36b0483195465fe99deeca`  
Updated: 2026-08-21

This is an execution ledger, not a replacement for the MALEK Canonical Pack. Canonical business/security/UX rules remain in `docs/source-of-truth/`; governed stage credit remains in `governance/10-stage-master-plan.json`.

## Operating rules

- One reversible milestone at a time.
- Repository reality, automated verification, runtime/live verification, and governed credit are reported separately.
- No production mutation, destructive migration, credential rotation, paid service, or public deployment without explicit approval.
- No new architecture or dependency unless a verified blocker proves it necessary.
- Every milestone must leave focused evidence, a reviewable diff, and an updated status record.

## Current prioritized milestones

| ID | Priority | Outcome | Status | Acceptance evidence |
| --- | --- | --- | --- | --- |
| M0 | Control | Establish a current Git/CI/test/runtime baseline and keep status documents current | VERIFIED COMPLETE | main SHA recorded; instructions and Canonical Pack read; current PR/branch state inspected; missing local/runtime evidence explicitly recorded |
| M1 | P1 security | Re-run repository credential, sensitive-write, auth/permission, migration-hygiene, and tenant-isolation guards from a current checkout | IMPLEMENTED BUT NOT VERIFIED | static source audit found no browser-secret exposure or direct journal mutation; current executable guard results are still required |
| M2 | P2 reliability | Restore a verified production build, typecheck, lint, architecture checks, and focused/full application tests | IN PROGRESS | PR #1535 repairs a Vercel-observed PostCSS build failure; latest repair build is blocked by external build-rate-limit |
| M3 | P2 journeys | Verify authenticated critical journeys: login/recovery, dashboard, property/unit, contract, financial collection/receipt, maintenance, reports, settings | NOT STARTED | QA/preview browser evidence with console/network results; no production mutation |
| M4 | P3 backend/security | Reconcile current repository migrations/types/RLS/RPC contracts with authorized disposable or QA Supabase evidence | BLOCKED_EXTERNAL | requires approved Supabase access and correct QA/demo target; no production database edits |
| M5 | P4 regression | Verify the offline shared-device logout safety regression and run focused/full checks | IMPLEMENTED BUT NOT VERIFIED | PR #1534 adds focused auth-service cases; execution and browser proof are still required |
| M6 | P5 mobile/RTL/a11y/PWA | Verify responsive, RTL, keyboard, reduced-motion, install/offline, and accessible state behavior | IMPLEMENTED BUT NOT VERIFIED | PR #1531 contains design foundations and PR #1533 hardens PWA cache/update behavior; rendered/e2e/device proof remains |
| M7 | P6 maintainability | Consolidate only proven duplicate patterns and update canonical evidence/docs | NOT STARTED | reduced duplicate surface with unchanged contracts and passing regression suite |
| M8 | Release | Controlled one-office QA/pilot and release decision | BLOCKED_EXTERNAL | all release-blocking gates green, hosted evidence, financial reconciliation, pilot evidence, explicit sign-off |

## Next milestone

M2 is the highest priority: verify the PR #1535 repair for the CSS build failure, then run its focused company/viewport tests. Live account grants remain a separate authorized administration action and are not to be changed through frontend work.

## Existing work being tracked

- PR #1531 `feat: establish MALEK design system foundation`: IMPLEMENTED BUT NOT VERIFIED, draft, frontend-only.
- PR #1533 `fix(pwa): fail closed offline and prompt safe updates`: IMPLEMENTED BUT NOT VERIFIED, draft; generated artifacts and device behavior still require execution.
- PR #1534 `fix(auth): protect shared devices when logout is offline`: IMPLEMENTED BUT NOT VERIFIED, draft; local-first logout and focused regression cases await execution.
- Canonical governance plan: `S01 COMPLETE; S02 PARTIAL; S03 PARTIAL; S04 NOT_STARTED; S05 PARTIAL; S06 NOT_STARTED; S07 PARTIAL; S08 NOT_STARTED; S09 NOT_STARTED; S10 NOT_STARTED`. This is governed credit, not a claim that repository implementation is absent.
- Current traceability baseline is historical and must be revalidated before using its old test counts as current evidence.

## Evidence policy

Do not write “fixed”, “complete”, or “production-ready” from a plan, code diff, component test, old CI run, or preview availability alone. Use the status vocabulary:

- VERIFIED COMPLETE
- IMPLEMENTED BUT NOT VERIFIED
- BLOCKED
- NOT STARTED
