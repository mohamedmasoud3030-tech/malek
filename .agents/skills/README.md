# Rentrix repo-scoped Agent Skills

These skills are local to this repository under `.agents/skills/`. Every agent starting work in Rentrix must read this index first, then open and apply every matching `SKILL.md` before changing code or docs. Apply every relevant skill when work crosses multiple domains — do not stop at the first match.

This set is intentionally pruned to the 10 skills with the highest signal for this stack (React 19/TypeScript/Vite + Supabase/Postgres) and this product's risk areas (financial correctness, data contracts, release readiness). If a task doesn't match any row below, fall back to `AGENTS.md` and the relevant `docs/` files — don't invent a skill.

## Rentrix-specific skills

| Skill | Use when | Path |
| --- | --- | --- |
| `frontend-integration` | A change creates, modifies, reviews, or claims completion of a user-facing screen, route, component, or workflow. | `.agents/skills/frontend-integration/SKILL.md` |
| `supabase-data-contracts` | A change touches Supabase migrations, RLS, RPCs, views, database services, generated database types, or UI/database contract alignment. | `.agents/skills/supabase-data-contracts/SKILL.md` |
| `financial-reporting` | A change affects collections, payments, receipts, settlements, bank reconciliation, owner/tenant statements, reporting totals, or financial calculations. | `.agents/skills/financial-reporting/SKILL.md` |
| `testing-release-readiness` | Before claiming any feature, fix, refactor, or release candidate is complete, verified, or release-ready. | `.agents/skills/testing-release-readiness/SKILL.md` |

## General-purpose imported skills

| Skill | Use when | Path |
| --- | --- | --- |
| `react-patterns` | Writing or reviewing React components, hooks, component composition, state, forms, or data-fetching boundaries. | `.agents/skills/react-patterns/SKILL.md` |
| `postgres-patterns` | Writing or reviewing PostgreSQL queries, indexes, schema design, RLS, or database performance/security changes (also covers migration and rollback safety). | `.agents/skills/postgres-patterns/SKILL.md` |
| `security-review` | Adding auth, authorization, input handling, secrets, sensitive data flows, third-party integrations, or payment/security-sensitive behavior. | `.agents/skills/security-review/SKILL.md` |
| `superpowers-systematic-debugging` | Encountering any bug, test failure, or unexpected behavior — before proposing a fix. Find root cause first; symptom fixes are failure. | `.agents/skills/superpowers-systematic-debugging/SKILL.md` |
| `error-handling` | Designing or reviewing typed errors, user-facing error messages, retries, error boundaries, and failure handling. | `.agents/skills/error-handling/SKILL.md` |
| `vite-patterns` | Working with Vite config, plugins, env variables, dev-server behavior, or production build behavior. | `.agents/skills/vite-patterns/SKILL.md` |

## Pruning note

This index previously included 21 skills across three sources (anthropics/skills, mattpocock/skills, obra/superpowers). On 2026-07-08 it was pruned to the 10 above to keep agent startup focused and low-token. Removed skills covered design/a11y/browser-QA automation, code-review/triage/research meta-workflows, and duplicate TDD/testing-strategy skills already covered by `testing-release-readiness` and `superpowers-systematic-debugging`. See `EXTERNAL_SOURCES.md` for the current vendored source list.
