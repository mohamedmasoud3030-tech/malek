# AI Agent Commands

This folder contains slash-style workflows for coding agents working on MALEK.

## Canonical documentation

Every command must treat these three documents as the active product/source of truth:

1. `docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`
2. `docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md`
3. `docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md`

Historical ADR/governance files remain authoritative only where the canonical documents explicitly identify them as locked or immutable.

## Command index

| Command | Purpose |
|---|---|
| `/new-feature <title>` | Convert a request into a buildable ticket without inventing rules |
| `/implement-db [slug]` | Implement schema/RPC/RLS/database contracts |
| `/implement-api [slug]` | Implement services and TanStack Query hooks |
| `/implement-ui [slug]` | Implement routes, pages, components and UX |
| `/verify-feature [slug]` | Run relevant verification gates |
| `/close-feature <slug>` | Update canonical reality/status and prepare the PR |
| `/run-all-checks` | Run the broad verification gate |

## Working rules

1. Read `AGENTS.md`, matching repo skills, and the three canonical documents before implementation.
2. Inspect current code before assuming a feature is absent or complete.
3. Keep diffs scoped and use atomic server/RPC writes for financial operations.
4. Never invent business/accounting/legal rules; record owner blockers and continue independent safe work.
5. Update only the relevant canonical status when implementation changes reality.
6. Git history is the archive; old TODO/status/handover documents are not active inputs.
