# CI Cost Policy

During active development, pull requests run only fast blocking validation: governance guards, typecheck, lint, architecture, frontend-database contract, and production build.

Expensive validation is deferred to manual or post-merge execution:
- full application tests
- financial safety suite
- canonical DB replay outside path-scoped DB changes
- multi-device Playwright browser matrix
- authenticated staging and full release blocker validation

Database-sensitive changes remain protected by the path-scoped canonical database baseline workflow. Full release/readiness workflows remain available through workflow_dispatch.

This policy exists to avoid duplicate dependency installs and repeated heavy suites on every commit while retaining release-grade validation when it is meaningful.
