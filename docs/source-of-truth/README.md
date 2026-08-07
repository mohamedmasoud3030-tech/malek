# MALEK — Source of Truth (Documentation System)

Created 2026-08-07 by a full-corpus documentation consolidation (branch `docs/source-of-truth-consolidation`). This folder is the **single entry point** for understanding the product. It consolidates 166 legacy documentation files into 15 canonical documents.

## Start here

1. [`00_Executive_Summary.md`](00_Executive_Summary.md) — findings, top-10 issues, immediate actions.
2. [`11_Current_Status.md`](11_Current_Status.md) — what is true *today*.

## The canonical set

| # | Doc | Owns (exclusively) |
|---|---|---|
| 01 | [Documentation Inventory](01_Documentation_Inventory.md) | Per-file disposition of all legacy docs |
| 02 | [Product Vision](02_Product_Vision.md) | Identity, users, jobs, operating models, non-goals |
| 03 | [Business Rules](03_Business_Rules.md) | D01–D18 and payment/VOID doctrine (binding text remains the LOCKED Arabic constitution & ADRs) |
| 04 | [Accounting](04_Accounting.md) | Money, invariants, GL platform, COA, settlements, posting spec |
| 05 | [Legal Workflows](05_Legal_Workflows.md) | End-to-end workflows + legal evidence list |
| 06 | [Architecture](06_Architecture.md) | Repo, frontend, security, DB, multi-tenancy, CI/CD |
| 07 | [UX Bible](07_UX_Bible.md) | IA, responsive/states/interaction/typography/print contracts |
| 08 | [Brand & Design](08_Brand_Design.md) | MALEK identity, assets, design-system rollout |
| 09 | [Feature Catalog](09_Feature_Catalog.md) | Every feature × purpose × verified status × doc provenance |
| 10 | [Roadmap](10_Roadmap.md) | Pilot, 10-stage plan (git-verified), decided-unimplemented, backlog, rejected |
| 11 | [Current Status](11_Current_Status.md) | Live truth: drift, stages, gates, posture |
| 12 | [Open Decisions](12_Open_Decisions.md) | OD-01…OD-19 + full missing-decision inventory |
| 13 | [Conflict Report](13_Conflict_Report.md) | C-01…C-09 + documentation-integrity clusters |
| 14 | [Deletion Proposal](14_Deletion_Proposal.md) | D-1…D-6 tiers — nothing deleted yet |

## Relationship to locked sources

These canonical docs **restate and organize**; the binding texts remain:

- `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` (SHA-guarded constitution)
- `docs/decisions/*.md` (ADRs; esp. 0011 D01–D18)
- `governance/*.json` + `.sha256` (locked plan & decision register)
- `docs/GOVERNANCE.md`, `docs/GOVERNANCE_LOG.md`

If a canonical doc ever disagrees with a locked source, the locked source wins and the canonical doc must be corrected in the same PR that causes the disagreement.

## Maintenance rule

- When a fact changes (feature shipped, decision taken, status moved), update **the one canonical owner document** — not a new scattered file.
- When a new decision is made: resolve/close the matching OD in `12_Open_Decisions.md` and propagate to the owning doc in the same PR.
- Stage/status changes route through the locked governance change-control (owner approval + ADR + hash bump + changelog), then `10_Roadmap.md`/`11_Current_Status.md` are refreshed to match.
- `13_Conflict_Report.md` entries should only move toward "resolved"; deleting a conflict requires its OD to be closed.

## Requirements coverage (for reviewers)

Inventory → `01`; Canonical documentation → `02`–`08`, `11`; Feature catalog → `09`; Conflict report → `13`; Open decisions → `12`; Deletion proposal → `14`; Executive summary → `00`.
