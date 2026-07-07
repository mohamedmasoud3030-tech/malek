# Rentrix repo-scoped Agent Skills

These skills are local to this repository under `.agents/skills/`. Apply every relevant skill when work crosses multiple domains.

| Skill | Use when | Path |
| --- | --- | --- |
| `frontend-integration` | A change creates, modifies, reviews, or claims completion of a user-facing screen, route, component, or workflow. | `.agents/skills/frontend-integration/SKILL.md` |
| `supabase-data-contracts` | A change touches Supabase migrations, RLS, RPCs, views, database services, generated database types, or UI/database contract alignment. | `.agents/skills/supabase-data-contracts/SKILL.md` |
| `financial-reporting` | A change affects collections, payments, receipts, settlements, bank reconciliation, owner/tenant statements, reporting totals, or financial calculations. | `.agents/skills/financial-reporting/SKILL.md` |
| `testing-release-readiness` | Before claiming any feature, fix, refactor, or release candidate is complete, verified, or release-ready. | `.agents/skills/testing-release-readiness/SKILL.md` |

## Imported ECC skills

The following general-purpose skills were imported from `affaan-m/ECC` because they are directly useful for building and maintaining Rentrix's React/Vite/Supabase application. Use them alongside the repo-specific skills above when their trigger conditions apply.

| Skill | Use when | Path |
| --- | --- | --- |
| `react-patterns` | Writing or reviewing React components, hooks, component composition, state, forms, or data-fetching boundaries. | `.agents/skills/react-patterns/SKILL.md` |
| `react-testing` | Writing or fixing React component, hook, or page tests with behavior-focused assertions. | `.agents/skills/react-testing/SKILL.md` |
| `vite-patterns` | Working with Vite config, plugins, env variables, dev-server behavior, or production build behavior. | `.agents/skills/vite-patterns/SKILL.md` |
| `frontend-a11y` | Building or reviewing interactive UI, forms, ARIA usage, keyboard behavior, focus management, or screen-reader support. | `.agents/skills/frontend-a11y/SKILL.md` |
| `browser-qa` | Verifying user-facing changes with browser automation, screenshots, console/network checks, and responsive smoke tests. | `.agents/skills/browser-qa/SKILL.md` |
| `design-system` | Creating, auditing, or reviewing styling, visual consistency, design tokens, and UI polish. | `.agents/skills/design-system/SKILL.md` |
| `database-migrations` | Planning or reviewing schema/data migrations, rollout safety, rollback strategy, and zero-downtime database changes. | `.agents/skills/database-migrations/SKILL.md` |
| `postgres-patterns` | Writing or reviewing PostgreSQL queries, indexes, schema design, RLS, or database performance/security changes. | `.agents/skills/postgres-patterns/SKILL.md` |
| `security-review` | Adding auth, authorization, input handling, secrets, sensitive data flows, third-party integrations, or payment/security-sensitive behavior. | `.agents/skills/security-review/SKILL.md` |
| `tdd-workflow` | Implementing features, bug fixes, or refactors where tests should drive and document the behavior. | `.agents/skills/tdd-workflow/SKILL.md` |
| `error-handling` | Designing or reviewing typed errors, user-facing error messages, retries, error boundaries, and failure handling. | `.agents/skills/error-handling/SKILL.md` |
