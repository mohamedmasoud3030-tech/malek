# MALEK repo-scoped Agent Skills

These skills are local to `.agents/skills/`. Every agent must read this index first, then open and apply every matching `SKILL.md` before changing code or docs.

Active product/source-of-truth context comes only from:

1. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`
2. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md`
3. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md`

Do not route work through removed status/TODO/archive documents.

## MALEK-specific skills

| Skill | Use when | Path |
| --- | --- | --- |
| `frontend-integration` | User-facing screen, route, component, or workflow work | `.agents/skills/frontend-integration/SKILL.md` |
| `supabase-data-contracts` | Migrations, RLS, RPCs, views, database services, generated DB types, or UI/database contract alignment | `.agents/skills/supabase-data-contracts/SKILL.md` |
| `financial-reporting` | Collections, payments, receipts, settlements, bank reconciliation, statements, totals, or financial calculations | `.agents/skills/financial-reporting/SKILL.md` |
| `testing-release-readiness` | Before claiming any feature/fix/refactor/release candidate complete | `.agents/skills/testing-release-readiness/SKILL.md` |

## General-purpose skills

| Skill | Use when | Path |
| --- | --- | --- |
| `react-patterns` | React components, hooks, composition, state, forms, or data-fetching boundaries | `.agents/skills/react-patterns/SKILL.md` |
| `react-testing` | React component/hook/page tests | `.agents/skills/react-testing/SKILL.md` |
| `postgres-patterns` | PostgreSQL queries, indexes, schema design, RLS, or DB performance/security | `.agents/skills/postgres-patterns/SKILL.md` |
| `database-migrations` | Schema/data migrations and rollback safety | `.agents/skills/database-migrations/SKILL.md` |
| `security-review` | Auth, authorization, secrets, sensitive data flows, or payment/security behavior | `.agents/skills/security-review/SKILL.md` |
| `superpowers-systematic-debugging` | Bugs, failed tests, or unexpected behavior | `.agents/skills/superpowers-systematic-debugging/SKILL.md` |
| `error-handling` | Typed errors, retries, user-facing failures, and boundaries | `.agents/skills/error-handling/SKILL.md` |
| `vite-patterns` | Vite config, plugins, env, dev-server, or build behavior | `.agents/skills/vite-patterns/SKILL.md` |
| `vibehub` | Vibe Coding requests, ambiguous wording, terminology clarification, or translating plain-language requirements into precise Agent prompts | `.agents/skills/vibehub/SKILL.md` |
| `browser-qa` | Browser-level validation when explicitly required by scope/policy | `.agents/skills/browser-qa/SKILL.md` |
| `design-system` | Visual consistency, layout, navigation, shared components | `.agents/skills/design-system/SKILL.md` |
| `frontend-a11y` | Interactive UI, forms, semantics, keyboard/focus, screen readers | `.agents/skills/frontend-a11y/SKILL.md` |

Use the canonical reality audit to determine whether work is complete, partial, deferred, or owner-blocked. Use `EXTERNAL_SOURCES.md` only for vendored-skill provenance, not product decisions.
