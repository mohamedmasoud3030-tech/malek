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

**The MALEK Canonical Pack is the single documentation entry point.**

Start at: [`docs/source-of-truth/00_INDEX.md`](docs/source-of-truth/00_INDEX.md)

The pack contains eight canonical documents:

1. [`docs/source-of-truth/01_PRODUCT_CHARTER_AND_SCOPE.md`](docs/source-of-truth/01_PRODUCT_CHARTER_AND_SCOPE.md) — Product definition, target customer, value, boundaries
2. [`docs/source-of-truth/02_OPERATING_MODELS_AND_JOURNEYS.md`](docs/source-of-truth/02_OPERATING_MODELS_AND_JOURNEYS.md) — Complete operating behavior for all models
3. [`docs/source-of-truth/03_DOMAIN_AND_DATA_MODEL.md`](docs/source-of-truth/03_DOMAIN_AND_DATA_MODEL.md) — Canonical entities and data integrity rules
4. [`docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md`](docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md) — Double-entry accounting model and GL specifications
5. [`docs/source-of-truth/05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`](docs/source-of-truth/05_SYSTEM_ARCHITECTURE_AND_SECURITY.md) — Technical architecture and security controls
6. [`docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md`](docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md) — Navigation hierarchy, visual contract, UX patterns
7. [`docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`](docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) — Brownfield traceability matrix and gap register
8. [`docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`](docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) — Work packages and release criteria

For governance and execution tracking:
- [`governance/final-decision-register.json`](governance/final-decision-register.json) — Locked decisions D01-D18
- [`governance/10-stage-master-plan.json`](governance/10-stage-master-plan.json) — 10-stage execution plan
- [`docs/decisions/`](docs/decisions/) — ADRs and decision files
- [`docs/execution/`](docs/execution/) — Arabic execution checklists

Read [`AGENTS.md`](AGENTS.md) before making changes.

## Contributing

Keep changes focused, run the relevant checks, and avoid committing generated build output or secrets. When documentation and code disagree, verify current code/database reality and update the appropriate canonical document in the same change.
