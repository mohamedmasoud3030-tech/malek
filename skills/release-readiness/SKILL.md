---
name: release-readiness
description: Define the evidence required before any feature, fix, phase, PR, build, or release candidate is called complete or ready to ship. Use when an agent is about to merge to main, tag a release, or declare readiness to the owner.
---

# Release Readiness

## Use when

About to claim a feature, fix, phase, PR, package, or release candidate is
complete, verified, ready to merge, or ready to ship.

## Required baseline

Start from latest `main`, inspect open PRs and current CI, then run the repo's
declared gates (install, test, typecheck, lint, build — exact commands from
the repo). Report exact commands and exact results. A skipped, unavailable, or
environment-blocked check is **not** a pass.

## Risk-based verification — select every applicable area

- **domain:** full happy path + blocked/edge transitions;
- **data:** migration, rollback, backup/restore, reset, relaunch, assets;
- **financial:** source-to-report reconciliation + daily close
  (apply `financial-correctness`);
- **UI:** phone, tablet, desktop, RTL, keyboard, failure/retry
  (apply `frontend-rtl-design`);
- **PWA/native:** install/startup, offline expectations, refresh, persisted data;
- **hardware/output:** camera/barcode fallback, print/PDF when affected;
- **security:** apply `security-review` when trust boundaries moved.

## Operational smoke path (when scope permits)

Verify one connected end-to-end business journey with fresh data in the
product's own canonical flow (e.g. booking→payment→delivery→return→settlement
→daily close→reports→backup/reset/restore→relaunch→verify restored records).

## Evidence standard — completion report must include

changed scope and excluded scope · tests added/updated · exact command results
· runtime scenarios and viewports/platforms · migration/rollback evidence where
applicable · known limitations outside acceptance criteria · links to issue/PR.

Forbidden phrases without evidence: "fully complete", "100% safe",
"production ready".

## Stop-the-line blockers

data loss/corruption/incomplete restore · incorrect balances/liabilities/
profitability/daily close · broken core workflow · failed startup/install/core
navigation · critical security issue.

Cosmetic polish goes to post-release; do not expand the active phase.

## Completion rule

Complete only when acceptance criteria, mandatory checks, the relevant runtime
matrix, failure-path tests, and evidence are all present and mutually consistent.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
