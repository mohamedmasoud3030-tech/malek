# Rentrix Engineering Policy

## Source-first workflow

- Inspect the repository root and `rentrix-app/` before editing.
- Use `rg --files` and `rg` when available.
- Verify the active route, service, schema, migration, and test paths from code.
- Do not assume that legacy, backup, archive, or PR code is active.

## Change discipline

- Keep each PR narrow and reversible.
- Avoid broad refactors during bug fixes or release-readiness work.
- Preserve dirty worktrees and avoid destructive Git commands.
- Do not delete risky files unless dead status is proven from actual imports, routes, build inputs, and runtime references.
- Reuse legacy code only after comparing it against the active architecture.

## Architecture constraints

- Keep the active application under `rentrix-app/`.
- Preserve TanStack Router, React Query, Supabase, i18n, RTL, and PWA direction.
- Do not restore incompatible legacy `react-router-dom`, `useApp`, `AppContext`, `dataService`, or local DB flows.
- Do not introduce a second state-management or balance-calculation path without an explicit architecture decision.

## Database and security

- Treat schema changes, migrations, RLS policies, storage policies, auth flows, and environment variables as sensitive.
- Keep migrations versioned, conservative, and reviewable.
- Validate referential integrity and RLS behavior for every affected table.
- Never commit secrets, service-role keys, or production data.

## UI and localization

- Arabic/RTL is the primary operational experience.
- Keep English/LTR functional.
- Validate desktop and mobile states for changed pages.
- Avoid placeholder copy and incomplete active navigation.

## Completion report

Every implementation report must include: root cause or objective, exact files changed, behavior changed, tests run, failed checks or blockers, migration impact, and commit SHA.