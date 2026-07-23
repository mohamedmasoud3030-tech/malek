# Rentrix documentation index

This directory contains the maintained sources of truth for the Rentrix repository. Documentation is point-in-time guidance: when it conflicts with executable code or a verified live database contract, code and the live contract win and the documentation must be corrected in the same change.

## Start here

- [`../AGENTS.md`](../AGENTS.md) — contributor and agent operating rules.
- [`agent-context/CONTEXT_MAP.md`](agent-context/CONTEXT_MAP.md) — mandatory task-routing map.
- [`APP_STATUS.md`](APP_STATUS.md) — verified current implementation, feature coverage, and live-state caveats.
- [`NEXT.md`](NEXT.md) — active product, data-correctness, and release backlog.

## Product and domain

- [`PRODUCT.md`](PRODUCT.md) — product scope and operating model.
- [`DOMAIN.md`](DOMAIN.md) — canonical entities, terminology, and accounting concepts.
- [`FEATURE_GAP_REGISTER.md`](FEATURE_GAP_REGISTER.md) — evidence-backed capability gaps that remain visible to tests and release work.
- [`decisions/`](decisions/) — accepted product and accounting decisions.

## Architecture and data contracts

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — maintained application architecture.
- [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) — database structure and boundaries.
- [`../supabase/migrations/README.md`](../supabase/migrations/README.md) — active migration-chain guidance.
- [`RPC_REFERENCE.md`](RPC_REFERENCE.md) — RPC reference; verify live definitions before high-risk changes.

## Delivery, governance, and verification

- [`TESTING.md`](TESTING.md) — test commands and verification expectations.
- [`ENGINEERING_GOVERNANCE.md`](ENGINEERING_GOVERNANCE.md) — engineering policy.
- [`GOVERNANCE.md`](GOVERNANCE.md) and [`GOVERNANCE_LOG.md`](GOVERNANCE_LOG.md) — production-change controls and approval evidence.
- [`RELEASE_READINESS.md`](RELEASE_READINESS.md) — current release criteria and blockers.
- CI still enforces the executable gate for the five launch-blocking risks via `.github/workflows/release-blocker-gate.yml`; the narrative doc describing it (`RELEASE_BLOCKER_GATE.md`) went stale relative to the live gate and is archived — verify current gate status directly against the workflow and `APP_STATUS.md` rather than a point-in-time narrative.
- [`RELEASE_EVIDENCE_LEDGER.md`](RELEASE_EVIDENCE_LEDGER.md) — evidence recorded for an exact release candidate.
- [`SEEDED_STAGING_READINESS_RUNBOOK.md`](SEEDED_STAGING_READINESS_RUNBOOK.md) — controlled staging validation.

## Documentation policy

Keep only maintained sources in the active tree. Historical audits, completed execution plans, superseded reviews, and one-off reports remain available through Git history and should not be recreated as archive folders as a matter of routine.

**Narrow exception (2026-07-23):** `PROJECT_STATUS.md`, `RELEASE_BLOCKER_GATE.md`, and `CURRENT_STATE.md` had drifted into direct contradiction with each other (different PR numbers, different verified-as-of dates spanning over a week) and with the live database/CI state. They were consolidated into the single `APP_STATUS.md` and moved to `docs/archive/` with dated filenames rather than deleted outright, specifically because their prior content had been cited as authoritative in past sessions and silent deletion would erase that trail. This is not a precedent for routinely archiving documents going forward — the default remains Git history, not an archive folder.

Do not create another standalone status report. Update `APP_STATUS.md` or add a decision record when a durable decision is required.
