# Rentrix repo-scoped Agent Skills

These skills are local to this repository under `.agents/skills/`. Every agent starting work in Rentrix must read this index first, then open and apply every matching `SKILL.md` before changing code or docs. Apply every relevant skill when work crosses multiple domains — do not stop at the first match.

This set is curated against this stack (React 19/TypeScript/Vite + Supabase/Postgres) and against the open work actually tracked in `docs/NEXT.md` and `docs/FEATURE_GAP_REGISTER.md` — not against an arbitrary count. If a task doesn't match any row below, fall back to `AGENTS.md` and the relevant `docs/` files — don't invent a skill.

## Rentrix-specific skills

| Skill | Use when | Path |
| --- | --- | --- |
| `frontend-integration` | A change creates, modifies, reviews, or claims completion of a user-facing screen, route, component, or workflow. | `.agents/skills/frontend-integration/SKILL.md` |
| `supabase-data-contracts` | A change touches Supabase migrations, RLS, RPCs, views, database services, generated database types, or UI/database contract alignment. | `.agents/skills/supabase-data-contracts/SKILL.md` |
| `financial-reporting` | A change affects collections, payments, receipts, settlements, bank reconciliation, owner/tenant statements, reporting totals, or financial calculations. Directly covers `FGR-001`, `FGR-002`, `FGR-003`, `FGR-005` in `docs/FEATURE_GAP_REGISTER.md`. | `.agents/skills/financial-reporting/SKILL.md` |
| `testing-release-readiness` | Before claiming any feature, fix, refactor, or release candidate is complete, verified, or release-ready. | `.agents/skills/testing-release-readiness/SKILL.md` |

## General-purpose imported skills

| Skill | Use when | Path |
| --- | --- | --- |
| `react-patterns` | Writing or reviewing React components, hooks, component composition, state, forms, or data-fetching boundaries. | `.agents/skills/react-patterns/SKILL.md` |
| `react-testing` | Writing or fixing tests for React components, hooks, or pages (RTL, Vitest/Jest, MSW mocking). Feeds test coverage needed for `FGR-001`/`FGR-002` and the release-readiness gate. | `.agents/skills/react-testing/SKILL.md` |
| `postgres-patterns` | Writing or reviewing PostgreSQL queries, indexes, schema design, RLS, or database performance/security changes. | `.agents/skills/postgres-patterns/SKILL.md` |
| `database-migrations` | Writing, reviewing, or applying schema/data migrations — safety, reversibility, zero-downtime, idempotency. Directly relevant to `docs/NEXT.md`'s pending migration items and `FGR-006` (bank reconciliation schema work). | `.agents/skills/database-migrations/SKILL.md` |
| `security-review` | Adding auth, authorization, input handling, secrets, sensitive data flows, third-party integrations, or payment/security-sensitive behavior. | `.agents/skills/security-review/SKILL.md` |
| `superpowers-systematic-debugging` | Encountering any bug, test failure, or unexpected behavior — before proposing a fix. Find root cause first; symptom fixes are failure. | `.agents/skills/superpowers-systematic-debugging/SKILL.md` |
| `error-handling` | Designing or reviewing typed errors, user-facing error messages, retries, error boundaries, and failure handling. | `.agents/skills/error-handling/SKILL.md` |
| `vite-patterns` | Working with Vite config, plugins, env variables, dev-server behavior, or production build behavior. | `.agents/skills/vite-patterns/SKILL.md` |
| `browser-qa` | Automated visual/UI verification after deploying a feature or fix — before shipping. Directly covers `FGR-007` ("Browser/E2E release readiness is missing"), the single largest open gap in `docs/FEATURE_GAP_REGISTER.md`. | `.agents/skills/browser-qa/SKILL.md` |
| `design-system` | Auditing visual consistency, reviewing PRs that touch styling, or working on layout/navigation. Directly relevant while `docs/archive/ui-2026-07-11-phase/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` work is active. | `.agents/skills/design-system/SKILL.md` |
| `frontend-a11y` | Building or reviewing any interactive UI component or form — semantic HTML, ARIA, keyboard nav, focus management, screen reader support. Relevant to the same active UX/navigation work, and to Rentrix's Arabic RTL forms specifically. | `.agents/skills/frontend-a11y/SKILL.md` |

## Selection note

This index was pruned from an original 21 skills down to 10 on 2026-07-08, then grown back to 15 after reviewing `docs/NEXT.md`, `docs/FEATURE_GAP_REGISTER.md`, and `docs/archive/ui-2026-07-11-phase/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` to confirm which general-purpose skills map to real open work (active UX/navigation/responsive audit, missing E2E/browser verification, pending migrations, and test-coverage gaps on financial RPC wiring). Skills not restored (mattpocock-*, superpowers-writing-plans, superpowers-test-driven-development, tdd-workflow, anthropics-frontend-design, anthropics-webapp-testing) remain excluded as meta-workflow or duplicate coverage already handled by `testing-release-readiness` and `superpowers-systematic-debugging`. See `EXTERNAL_SOURCES.md` for the current vendored source list.
