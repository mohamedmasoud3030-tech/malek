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

Use the repository-pinned pnpm version. The brownfield audit verified the current baseline with pnpm `10.11.1`; do not silently switch package-manager major versions when diagnosing build/test failures.

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
7. [`docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`](docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) — 77-rule brownfield traceability matrix and 23-gap register
8. [`docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`](docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) — Seven closeout work packages and release criteria

### Do not collapse these states

MALEK explicitly separates:

- **Canonical rule** — what the product must do.
- **Repository Reality** — what code/migrations/tests/evidence actually exist at the cited SHA.
- **Governed Stage Credit** — what `governance/10-stage-master-plan.json` plus Agent/Reviewer ledgers officially credit.
- **Runtime/live verification** — what has been proven in the deployed environment.

A migration/test may exist for S04/S06/S08 while the governance ledger still grants no completion credit. Conversely, a historical document cannot prove current implementation. Read Document 7 before saying a module “does not exist” or “is complete.”

For governance and execution tracking:
- [`governance/final-decision-register.json`](governance/final-decision-register.json) — Locked decisions D01-D18
- [`governance/10-stage-master-plan.json`](governance/10-stage-master-plan.json) — Governed 10-stage execution plan/status
- [`docs/execution/`](docs/execution/) — Arabic execution checklists/ledgers

Read [`AGENTS.md`](AGENTS.md) before making changes.

## Contributing

Keep changes focused, run the relevant checks, and avoid committing generated build output or secrets. When documentation and code disagree, preserve locked/canonical business rules, record the implementation reality in the traceability matrix, and do not grant stage completion unless the governance process authorizes it.
