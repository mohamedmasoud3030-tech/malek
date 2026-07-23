# Next Actions

## Current checkpoint

All previously open repository PRs (#1233, #1269, and #1271) are merged, and
GitHub currently reports zero open PRs. See [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
for the authoritative current status.

## Completed repository work

- Migration-history reconciliation and company-isolation fixes are present on
  `main`.
- Paginated financial reads have deterministic ordering and regression tests.
- Build, typecheck, lint, application tests, financial tests, deployment, and
  report-status checks are passing.
- The remote-only migration ledger version `20260721234207` has a matching
  local no-op reconciliation marker.
- Replay compatibility fixes cover legacy `companies`, `company_members`,
  policies, company foreign keys, and UUID/text payment comparisons.

## Required before release sign-off

1. Inspect the one production payment row rejected by the payment/receipt
   identity preflight.
2. Produce an approved, transactionally guarded repair plan that preserves
   allocations, invoices, journals, and audit history.
3. Verify a restorable database and Storage backup before any production write.
4. Apply the minimal approved repair, then rerun Supabase Preview and the
   release-blocker database gate.
5. Resolve SonarCloud’s Automatic Analysis scope or switch to CI-based analysis,
   then rerun the quality gate.
6. Rerun all required GitHub checks and record the final commit and check URLs.

## Safety rules

- Do not bypass the payment identity preflight.
- Do not use `supabase db repair`, `supabase db push`, or direct production SQL
  until the backup and repair plan are approved.
- Do not delete QA or financial rows ad hoc.
- Do not claim production readiness from local tests alone.
- Revoke any credentials shared during troubleshooting.
