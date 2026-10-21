# 0022 — Duplication is measured and ratcheted, and migrations are exempt

- **Status:** Accepted
- **Date:** 2026-10-21
- **Rules touched:** `REL-001` (repository reality is reported separately from claims)
- **Files:** `scripts/check-duplication.mjs`, `scripts/agent-local-gate.mjs`, `package.json`

## Context

The repository carried no local measurement of duplicated code, while SonarCloud reported
`3.0% Duplication on New Code` as a **failed** quality condition on `main`. A quality signal that
lives only in an external dashboard is not actionable from a commit, and a one-off cleanup without a
ratchet regresses within weeks.

Measured with `jscpd@4.3.0` at `2c117e48` (`--min-tokens 50`, `--min-lines 5`):

| Scope | Duplicated lines | Share of all duplication |
| --- | ---: | ---: |
| `supabase/migrations/**` (SQL) | 4,222 | 68.0% |
| Production TypeScript (`malek-app/src`, no tests) | 1,783 | 28.7% |
| Other (scripts, config) | 281 | 4.5% |

## Decision

### 1. `supabase/migrations/**` is permanently exempt

`DATABASE_RULES.md`: *"A merged migration is immutable. Fixes are new forward migrations."*
`check:migration-hygiene` enforces this as Rule 3 — no rename, no delete, no content change.

The 4,222 duplicated SQL lines are the **price of an append-only ledger**, not debt. Deduplicating
them would rewrite migrations that have shipped, break migration-ledger parity, and is precisely what
the guard exists to prevent. A ratchet that counted them could never be satisfied honestly, so they
are excluded by construction rather than by convenience.

### 2. Production TypeScript is ratcheted, not merely reported

`scripts/check-duplication.mjs` runs `jscpd` over `malek-app/src` (TypeScript/TSX, tests excluded) and
fails when duplication exceeds `THRESHOLD_PERCENT`. The threshold is a **ratchet**, the same pattern as
the debt allow-lists in `malek-app/scripts/check-architecture.mjs`: it may only be lowered. Lowering it
happens in the same commit that earns the reduction. Raising it requires a stated reason in the PR
body, because raising it silently is how such a guard becomes decorative.

It is wired into `gate:local` **default mode** (not quick mode): ~9 s over ~1,000 files is too slow for
the inner loop and too important to skip before a commit.

### 3. `docs/**` is out of scope

Repeated prose across governed documents is usually a quotation of a canonical rule. Collapsing it
would create the second source of truth `AGENTS.md` forbids.

## What this change actually removed

This was not a measurement-only change. Three real extractions landed with it, taking production
TypeScript duplication from **1.35% → 1.03%** (1,783 → 1,362 lines, 132 → 123 clones):

| Extraction | Removed | Note |
| --- | ---: | --- |
| `features/owners/components/owner-receivable-panel-parts.tsx` | 143 | The offset and cash-recovery panels duplicated the picker, the four-fact grid, the amount/date fields and the feedback block. Same row type (`OwnerReceivable`), same queries. |
| `features/people/components/dossier-contracts-section.tsx` | ~120 | The person dossier and the tenant dialog rendered the same contract list. `tenants` already depends on `people` in the architecture allow-list. |
| `mapCoveringTaxWindow` / `mapDraftTaxWindow` in `finance-readiness-service.ts` | ~24 | Four query functions coerced the same columns twice each. |

The dossier extraction also fixed a real inconsistency: the tenant dialog printed raw ISO
`start_date`/`end_date` while the person dossier formatted them through the company formatters. Both
now format. That is a behaviour change, stated here rather than buried.

## What was deliberately not touched

`PersonDossier.tsx` and `TenantPreviewDialog.tsx` still share ~180 lines of *page structure* — tab
routing, the header block, the financial summary. They are two different domains (a person is not a
tenant) with different data hooks, different sections and different permission branches. Merging them
into one parameterized component would trade 180 duplicated lines for a component with a branch per
caller, which is harder to review and easier to break. The remaining duplication is recorded, measured
and ratcheted; it is a known quantity, not an unexamined one.

## Consequence

Duplication can no longer grow without a red gate. The number in the guard is now the honest answer to
"how much duplication is in this repository", and the 68% that cannot be removed is documented with
the rule that makes it immutable instead of being silently excluded from the total.
