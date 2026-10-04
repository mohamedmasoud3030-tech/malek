# CI Cost Policy

> **WP-00 configuration reconciliation (2026-10-04):** this document records
> intended cost allocation, not the current PR job inventory. At checkout
> `af4bd0fa03b63dbf07d4643cbd75f81ca4cd7d68`, `.github/workflows/ci.yml` runs
> test typecheck, accessibility, full application tests, frontend/backend
> runtime contract tests, and the six-role RLS matrix in the PR `build` job,
> alongside typecheck, architecture, frontend/database checks, and build. Its
> separate `heavy-validation` job runs only outside pull requests and includes
> canonical DB integrity and financial safety tests. Browser readiness, hosted
> staging, and release-blocker validation are in separate workflows. The
> workflow is the effective configuration; this policy/workflow mismatch is
> unresolved. This note does not weaken or remove any gate.

During active development, pull requests run only fast blocking validation: governance guards, typecheck, lint, architecture, frontend-database contract, and production build.

Expensive validation is deferred to manual or post-merge execution:
- full application tests
- financial safety suite
- canonical DB replay outside path-scoped DB changes
- multi-device Playwright browser matrix
- authenticated staging and full release blocker validation

Database-sensitive changes remain protected by the path-scoped canonical database baseline workflow. Full release/readiness workflows remain available through workflow_dispatch.

This policy exists to avoid duplicate dependency installs and repeated heavy suites on every commit while retaining release-grade validation when it is meaningful.
