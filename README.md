# MALEK

**كل أملاكك في مكان واحد**

MALEK is an Arabic-first rental-property management web application for properties, units, people, contracts, financial workflows, maintenance, reports, and settings.

> **Compatibility note:** the repository name, `rentrix-app/` package path, historical database identifiers, persisted keys, and some infrastructure names intentionally remain unchanged. User-visible product naming is MALEK.

**Execution model (2026-09-12): human-driven sessions.** One task, one session, one branch from `origin/main`, one PR — see [`docs/decisions/0018-execution-model-human-driven-sessions.md`](docs/decisions/0018-execution-model-human-driven-sessions.md) and [`docs/archive/2026-09-reconstruction/README.md`](docs/archive/2026-09-reconstruction/README.md). No autonomous handoff loop.

## Application location

The active application lives in `rentrix-app/`. Repository-level governance, CI, scripts, Supabase assets, immutable decisions, and the canonical documentation remain at the root.

## Basic commands

```bash
pnpm install --frozen-lockfile
pnpm --filter ./rentrix-app dev
pnpm verify:quick          # <3 min daily gate: 4 prod-safety invariants + architecture + type/contract parity
pnpm verify:full           # pre-release: quick + guardian:core + advisory
pnpm typecheck
pnpm --filter ./rentrix-app run test
```

Use the repository-pinned pnpm version `10.11.1`; do not silently switch package-manager major versions when diagnosing build/test failures.

## Documentation — single entry point

**This README is the single living entry point** (ADR 0018). No new `HANDOFF.md` / `NEXT_AGENT_PROMPT.md` / `CURRENT_STATE*.md` at the repo root — see [`docs/archive/2026-09-reconstruction/README.md`](docs/archive/2026-09-reconstruction/README.md).

Start at: [`docs/source-of-truth/00_INDEX.md`](docs/source-of-truth/00_INDEX.md)

The Canonical Pack is the product truth (Target Architecture Lock 2026-08-27):

1. [`01 — Product charter`](docs/source-of-truth/01_PRODUCT_CHARTER_AND_SCOPE.md) — Product definition, target customer, value, boundaries
2. [`02 — Operating models`](docs/source-of-truth/02_OPERATING_MODELS_AND_JOURNEYS.md) — Complete operating behavior for all models
3. [`03 — Domain & data model`](docs/source-of-truth/03_DOMAIN_AND_DATA_MODEL.md) — Canonical entities and data integrity rules
4. [`04 — Finance & accounting`](docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md) — Double-entry accounting model and GL specifications
5. [`05 — Architecture & security`](docs/source-of-truth/05_SYSTEM_ARCHITECTURE_AND_SECURITY.md) — Technical architecture and security controls
6. [`06 — UX / IA contract`](docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md) — Navigation hierarchy, visual contract, UX patterns
7. [`07 — Implementation reality`](docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) — 77-rule traceability matrix and 23-gap register
8. [`08 — Closeout roadmap`](docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) — Seven work packages (WP-01…WP-07) and release gates

Addendum: [`08A_RC1_CLOSEOUT_ADDENDUM.md`](docs/source-of-truth/08A_RC1_CLOSEOUT_ADDENDUM.md)

### Do not collapse these states

MALEK explicitly separates:

- **Canonical rule** — what the product must do.
- **Repository Reality** — what code/migrations/tests/evidence actually exist at the cited SHA.
- **Governed Stage Credit** — what `governance/10-stage-master-plan.json` plus Agent/Reviewer ledgers officially credit (now path-scoped advisory — see [`docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md`](docs/GOVERNANCE_TOOLING_AUDIT_2026-09-12.md)).
- **Runtime/live verification** — what has been proven in the deployed environment.

A migration/test may exist for S04/S06/S08 while the governance ledger still grants no completion credit. Conversely, a historical document cannot prove current implementation. Read Document 7 before saying a module “does not exist” or “is complete.”

For governance and execution tracking:
- [`governance/final-decision-register.json`](governance/final-decision-register.json) — Locked decisions D01-D18
- [`governance/10-stage-master-plan.json`](governance/10-stage-master-plan.json) — 10-stage plan (archived reference — path-scoped, see governance audit)
- [`docs/decisions/`](docs/decisions/) — ADRs (0018 is the execution-model decision)
- [`docs/execution/`](docs/execution/) — Arabic execution checklists/ledgers (superseded, kept for history)

Read [`AGENTS.md`](AGENTS.md) before making changes. `CLAUDE.md` mirrors the same human-driven model for Claude Sessions.

## Contributing — ongoing discipline

This is **ongoing discipline, not a one-time task** (ADR 0018):

- Do not create parallel source-of-truth docs. Update the Canonical Pack instead.
- Do not create `HANDOFF*.md`, `NEXT_AGENT*.md`, `*_AUDIT.md`, or `CURRENT_STATE*.md` at the root — open a GitHub issue and an ADR if a durable decision is needed.
- Keep changes focused, run the relevant checks (`pnpm verify:quick`), and avoid committing generated build output or secrets. When documentation and code disagree, preserve locked/canonical business rules, record the implementation reality in the traceability matrix, and do not grant stage completion unless the governance process authorizes it.
