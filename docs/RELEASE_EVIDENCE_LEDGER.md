# Release Evidence Ledger for 99.9% Readiness

This ledger is the evidence checklist for any future Rentrix 99.9% readiness claim. A local pass is not enough: each row must link to a CI run, operator log, or signed product/accounting decision before the claim is defensible.

## Evidence states

| State | Meaning |
| --- | --- |
| Required | Evidence does not exist yet and blocks the readiness claim. |
| Local pass | The check passed in a developer environment but is not sufficient for production readiness by itself. |
| CI pass | The check passed in CI for the release commit. |
| Operator verified | An approved operator ran the read-only/live check and archived output. |
| Product decided | Product/accounting owner supplied an explicit decision record or spec. |
| Blocked | A required secret, credential, staging seed, or decision is unavailable. |

## Mandatory evidence before a 99.9% claim

| Evidence item | Required state | Current branch status | Artifact to archive |
| --- | --- | --- | --- |
| Install/typecheck/lint/build/test suite | CI pass | Local commands are available; CI artifact required per release commit | CI run URL and commit SHA |
| Financial tests and readiness gates | CI pass | Local financial/readiness tests exist | CI test output for `test:financials` and readiness tests |
| Browser smoke across desktop/tablet/mobile | CI pass | Playwright smoke exists; local pass is not a release artifact | Browser readiness workflow run, screenshots, traces on failure |
| Seeded authenticated staging journey | CI pass or operator verified | Blocked until `E2E_BASE_URL` and seeded `E2E_TEST_*` credentials exist | Workflow dispatch URL, seeded tenant/owner/property ids, screenshots |
| Supabase live read-only readiness | Operator verified | Blocked until `SUPABASE_DB_URL` and `psql` are available in an approved environment | `supabase:live-readiness` output and target project id |
| Financial invoice -> payment -> receipt -> void -> report proof | Operator verified | Required; must not run against production without approved staging/seed plan | Runbook output, receipt/payment/report identifiers, rollback notes |
| Backend financial RPC/RLS/grant authorization proof | Operator verified | Required; frontend permissions do not prove backend enforcement | Read-only SQL output for `pg_policies`, `pg_proc`, grants, and denied-action checks |
| Product/accounting decision gates | Product decided | Product decisions are recorded in `docs/decisions/0001-product-accounting-policies.md`, `docs/decisions/0002-staging-live-verification-and-release-evidence.md`, and `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md`; implementation evidence remains required | Decision records plus implementation/evidence links for each affected workflow |
| Manual RTL/mobile/device validation | Operator verified | Required for high-traffic authenticated workflows | Device/browser matrix, screenshots, issues opened |

## Release rule

Do not label a release candidate as 99.9% ready unless every mandatory evidence item is in its required state for the exact release commit. If a row is blocked, the release notes must say which readiness claim is blocked and what credential, seed, implementation proof, decision amendment, or operator action is missing. Product/accounting decisions are now recorded, but they do not replace implementation, staging, live read-only, backend authorization, or sign-off evidence.
