# Rentrix documentation index

This directory contains the maintained sources of truth for the Rentrix repository. Documentation is point-in-time guidance: when it conflicts with executable code or a verified live database contract, code and the live contract win and the documentation must be corrected in the same change.

## Start here

- [`../AGENTS.md`](../AGENTS.md) — contributor and agent operating rules.
- [`agent-context/CONTEXT_MAP.md`](agent-context/CONTEXT_MAP.md) — mandatory task-routing map.
- [`CURRENT_STATE.md`](CURRENT_STATE.md) — verified current implementation and live-state caveats.
- [`NEXT.md`](NEXT.md) — active product, data-correctness, and release backlog.

## Product and domain

- [`PRODUCT.md`](PRODUCT.md) — product scope and operating model.
- [`DOMAIN.md`](DOMAIN.md) — canonical entities, terminology, and accounting concepts.
- [`FEATURE_GAP_REGISTER.md`](FEATURE_GAP_REGISTER.md) — evidence-backed capability gaps.
- [`decisions/`](decisions/) — accepted product and accounting decisions.

## Architecture

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — maintained application architecture.
- [`ARCHITECTURE_EXECUTION_PLAN.md`](ARCHITECTURE_EXECUTION_PLAN.md) — completed architecture-refactor phases and verification rules.
- [`DATABASE_ARCHITECTURE.md`](DATABASE_ARCHITECTURE.md) — database structure and boundaries.
- [`DATABASE_BASELINE_GUIDE.md`](DATABASE_BASELINE_GUIDE.md) — baseline and migration guidance.
- [`RPC_REFERENCE.md`](RPC_REFERENCE.md) — RPC reference; verify live definitions before high-risk changes.

## Delivery, governance, and verification

- [`TESTING.md`](TESTING.md) — test commands and verification expectations.
- [`ENGINEERING_GOVERNANCE.md`](ENGINEERING_GOVERNANCE.md) — engineering policy.
- [`GOVERNANCE.md`](GOVERNANCE.md) and [`GOVERNANCE_LOG.md`](GOVERNANCE_LOG.md) — production-change controls and audit log.
- [`RELEASE_READINESS.md`](RELEASE_READINESS.md) — release-readiness criteria.
- [`LIVE_VERIFICATION_READINESS.md`](LIVE_VERIFICATION_READINESS.md) — live verification status and prerequisites.
- [`SEEDED_STAGING_READINESS_RUNBOOK.md`](SEEDED_STAGING_READINESS_RUNBOOK.md) — controlled staging validation.

## Historical evidence

Completed audits, superseded plans, and point-in-time execution reports are retained under [`archive/`](archive/). They are evidence, not the current backlog or architecture authority. In particular, repository-root reports consolidated by Architecture Phase E live in [`archive/legacy-root-reports/`](archive/legacy-root-reports/).

Do not create a new root-level status report. Update the maintained source above, add a decision record when a durable decision is required, or place immutable historical evidence in `docs/archive/`.
