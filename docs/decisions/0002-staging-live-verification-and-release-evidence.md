# 0002. Staging, live verification, and release evidence governance

## Context
The 99.9% readiness work created local gates and runbooks, but authenticated staging journeys, live Supabase read-only checks, and release evidence rules were still blocked on owner/operator decisions.

## Decision
Mutating financial journeys must never run on production. They may run only on a staging or preview environment that is explicitly safe for seeded data. The product owner will provide `E2E_BASE_URL`; until then, seeded authenticated browser verification remains open.

Seeded staging should use a stable `RENTRIX_STAGING_SEED_ID` where practical, with documented reset/cleanup. CI may use run-specific seeds if cleanup is clear. Test credentials must be CI secrets, never hardcoded, and should include admin/operator, manager, read-only/viewer, and accountant users as needed.

Authenticated financial E2E is manual or scheduled by default unless the environment is seed-isolated. Non-mutating browser smoke may run on PRs. `SUPABASE_DB_URL` must be read-only, targets staging first, and production only for final read-only live verification. Manual GitHub Actions workflows may run with read-only credentials, and outputs must be archived as GitHub Actions artifacts with key summaries copied into `docs/release-evidence`.

Every release needs an evidence ledger identified by commit SHA plus release tag/version. Production migrations require explicit approval and rollback or mitigation notes. A 99.9% readiness claim requires explicit final sign-off from the product owner/decision owner after the evidence ledger is complete. Live readiness and financial evidence must be fresh within 7 days of release.

## Alternatives rejected
Running mutating golden-path checks in production was rejected. Storing credentials in the repository was rejected. Treating local developer passes as release evidence was rejected. Staging-only evidence was rejected as insufficient for final release because production still needs read-only live verification.

## Consequences
Engineering must keep seeded staging and production read-only verification separate. Release preparation now requires artifacts, seed identifiers, run URLs, reset notes, migration approval/rollback notes, and sign-off, not just passing local tests. Implementation may add automation around `docs/release-evidence`, but the evidence and sign-off requirements remain mandatory.

## Evidence
This decision records the explicit product-owner instruction supplied in the current task on 2026-07-09. It updates the policy behind `docs/SEEDED_STAGING_READINESS_RUNBOOK.md` and `docs/RELEASE_EVIDENCE_LEDGER.md`.
