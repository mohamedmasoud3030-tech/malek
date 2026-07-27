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
| Install/typecheck/lint/build/test suite | CI pass | CI pass: run `30227200374` on `7dde0036`, squash-merged to application release `4c354f34` | CI run URL and commit SHA |
| Financial tests and readiness gates | CI pass | CI pass: runs `30227200374` and `30227200394` | CI test output for `test:financials` and readiness tests |
| Browser smoke across desktop/tablet/mobile | CI pass | CI pass: run `30227200393`; 243 passed, 204 intentional skips, 0 failed in 9.1m | Browser readiness workflow run and Playwright report artifact |
| Seeded authenticated staging journey | CI pass or operator verified | Release Blocker authenticated read-only job passed with zero skips; isolated local Supabase journey passed separately | Workflow run `30227200394`, seeded local launch evidence |
| Supabase live read-only readiness | Operator verified | Operator verified on project `nnggcnpcuomwfuupupwg` at 2026-07-27 | Latest ledger, company/account counts, advisors |
| Financial invoice -> payment -> receipt -> void -> report proof | Operator verified | Verified in disposable local Supabase gate; intentionally not executed against Production | Single-office launch artifact from run `30227200394` |
| Vercel Production deployment and public alias | Operator verified | Deployment `dpl_GB7bQucwLdCCFEePFPWNP6ZvPdia` is `READY` for `4c354f34`; official `/login` returned `200`; no runtime errors in the verification hour | Deployment inspector, alias response, runtime error scan |
| Backend financial RPC/RLS/grant authorization proof | Operator verified | Required; frontend permissions do not prove backend enforcement | Read-only SQL output for `pg_policies`, `pg_proc`, grants, and denied-action checks |
| Product/accounting decision gates | Product decided | Product decisions are recorded in `docs/decisions/0001-product-accounting-policies.md`, `docs/decisions/0002-staging-live-verification-and-release-evidence.md`, and `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md`; implementation evidence remains required | Decision records plus implementation/evidence links for each affected workflow |
| Manual RTL/mobile/device validation | Operator verified | Desktop RTL blocker closed in #1292; automated matrix passed. Final real-device operator sign-off remains part of Pilot day 1 | Device/browser matrix, screenshots, operator note |

## Release rule

Do not label a release candidate as 99.9% ready unless every mandatory evidence item is in its required state for the exact release commit. If a row is blocked, the release notes must say which readiness claim is blocked and what credential, seed, implementation proof, decision amendment, or operator action is missing. Product/accounting decisions are now recorded, but they do not replace implementation, staging, live read-only, backend authorization, or sign-off evidence.
