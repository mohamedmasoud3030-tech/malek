# MALEK

**كل أملاكك في مكان واحد**

MALEK is an Arabic-first rental-property management web application for properties, units, people, contracts, financial workflows, maintenance, reports, and settings.

> **Compatibility note:** the repository name, `rentrix-app/` package path, historical database identifiers, persisted keys, and some infrastructure names intentionally remain unchanged. User-visible product naming is MALEK.

## Application location

The active application lives in `rentrix-app/`. Repository-level governance, CI, scripts, Supabase assets, immutable decisions, and the canonical documentation remain at the root.

## Basic commands

```bash
pnpm install --frozen-lockfile
pnpm --filter ./rentrix-app dev
pnpm typecheck
pnpm lint
pnpm check:docs
pnpm build
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

## Documentation — start here

There are only three active product/source-of-truth documents:

1. [`docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md`](docs/source-of-truth/01_CANONICAL_REALITY_AND_STATUS.md) — verified feature and UX reality.
2. [`docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md`](docs/source-of-truth/02_BUSINESS_CONSTITUTION_AND_ACCOUNTING.md) — business, accounting, legal, brand, and document rules.
3. [`docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md`](docs/source-of-truth/03_TECHNICAL_ARCHITECTURE_AND_ROADMAP.md) — architecture, execution order, blockers, and owner decisions.

For immutable historical decisions and CI-protected governance, use the ADR/decision and governance files referenced by those three documents. Old status reports, plans, TODOs, handovers, and duplicate summaries are intentionally removed from the active tree; Git history is the archive.

Read [`AGENTS.md`](AGENTS.md) before making changes.

## Contributing

Keep changes focused, run the relevant checks, and avoid committing generated build output or secrets. When documentation and code disagree, verify current code/database reality and update the appropriate canonical document in the same change.
