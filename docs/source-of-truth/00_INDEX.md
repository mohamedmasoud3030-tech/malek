# MALEK Canonical Pack — Index

> **Status:** CANONICAL  
> **Effective Date:** 2026-08-10  
> **Branch:** `arena/019fecf2-malik`  
> **Authority:** This document is the authoritative manifest for the MALEK Canonical Pack.

---

## Purpose

This document establishes the single source of truth for the MALEK property management system. It defines the structure, authority, and change-control rules for all canonical documentation.

---

## The Eight Canonical Documents

| # | Document | Purpose |
|---|---|---|
| 1 | [`01_PRODUCT_CHARTER_AND_SCOPE.md`](01_PRODUCT_CHARTER_AND_SCOPE.md) | Product definition, target customer, value, boundaries, and release scope |
| 2 | [`02_OPERATING_MODELS_AND_JOURNEYS.md`](02_OPERATING_MODELS_AND_JOURNEYS.md) | Complete operating behavior for all supported operating models |
| 3 | [`03_DOMAIN_AND_DATA_MODEL.md`](03_DOMAIN_AND_DATA_MODEL.md) | Canonical entities, relationships, statuses, and data integrity rules |
| 4 | [`04_FINANCE_AND_ACCOUNTING_MODEL.md`](04_FINANCE_AND_ACCOUNTING_MODEL.md) | Double-entry accounting model, event-to-accounting mappings, GL specifications |
| 5 | [`05_SYSTEM_ARCHITECTURE_AND_SECURITY.md`](05_SYSTEM_ARCHITECTURE_AND_SECURITY.md) | Technical architecture, multi-tenant isolation, permission model, RPC boundaries |
| 6 | [`06_UX_IA_AND_DESIGN_CONTRACT.md`](06_UX_IA_AND_DESIGN_CONTRACT.md) | Navigation hierarchy, visual contract, UX patterns, and design tokens |
| 7 | [`07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`](07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) | Brownfield traceability matrix and gap register |
| 8 | [`08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`](08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) | Work packages, release gates, and closeout criteria |

---

## Authority and Precedence

When documentation conflicts occur, resolve using this precedence order:

1. **Approved canonical rule in the eight-document pack** — These documents represent the binding source of truth
2. **Verified current implementation evidence** — Code and database reality that contradicts documents must be recorded as a gap
3. **Active ADR explicitly referenced by the pack** — ADRs in `docs/adr/` that are explicitly cited in canonical documents
4. **Supporting documentation** — `docs/` subdirectories that do not conflict with canonical documents
5. **Historical or superseded documentation** — Archived documents preserved for evidence purposes only

### Implementation Evidence vs. Canonical Rules

Implementation evidence describes what the code currently does, but it **does not silently override** an approved canonical business rule. When implementation conflicts with a canonical rule:

1. Preserve the approved canonical rule
2. Classify the implementation as a CONFLICT in the traceability matrix
3. Assign the gap to the appropriate work package
4. Resolve the conflict explicitly — never by redefining the rule to match existing code

---

## Rule ID Ownership

Each canonical rule is identified by a stable Rule ID:

| Prefix | Domain |
|--------|--------|
| PRD-### | Product scope and vision |
| OPS-### | Operating models and journeys |
| DOM-### | Domain and data model |
| FIN-### | Finance and accounting |
| SEC-### | Security and permissions |
| UX-### | UX, IA, and design |
| REL-### | Release and closeout |

Rule IDs are assigned in the traceability matrix (`07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`). Code-changing PRs must cite affected rule IDs in the PR description and update the traceability matrix when implementation status changes.

---

## Document Status Vocabulary

| Status | Meaning |
|--------|---------|
| CANONICAL | Active authority; governs current and future implementation |
| SUPPORTING | Valid supporting material; does not override canonical documents |
| SUPERSEDED | Replaced by a newer canonical document; preserved for historical evidence |
| HISTORICAL | Archived evidence; not authoritative for current decisions |

---

## Change-Control Policy

### Canonical Document Changes

Changes to canonical documents require:

1. PR description citing affected Rule IDs
2. Updated traceability matrix entries
3. No contradiction of locked decisions in `governance/final-decision-register.json`
4. For constitutional changes (D01-D18): new ADR, product owner approval, and SHA-256 hash bump

### Implementation PR Requirements

Every PR that changes code must:

1. Cite affected Rule IDs in the description
2. Update the traceability matrix if implementation status changes
3. Not introduce parallel source-of-truth documents
4. Record unresolved conflicts explicitly rather than selecting a convenient interpretation
5. Not declare a module complete based solely on a component test or merged PR

---

## Conflict Resolution Process

When a conflict is discovered between:

1. **Canonical document vs. code** → Preserve the canonical rule; record implementation as CONFLICT
2. **Canonical document vs. ADR** → If ADR is explicitly referenced, ADR governs; otherwise canonical wins
3. **Canonical document vs. old documentation** → Canonical wins; archive old document
4. **Two canonical documents** → Bring to product owner for resolution; neither takes precedence unilaterally

All unresolved conflicts must be:
- Recorded in the gap register with BLOCKED_EXTERNAL classification if external approval required
- Assigned to a work package with a clear resolution path
- Visible in the traceability matrix until resolved

---

## Deduplication Requirements

- Each gap appears exactly once in the gap register
- Each Rule ID appears exactly once in the traceability matrix (cross-references allowed)
- Each work package owns a specific set of gap IDs
- No active legacy document may claim competing source-of-truth authority

---

## Repository Integration

### README.md

`README.md` links to this index as the single documentation entry point. All other documentation paths are secondary.

### AGENTS.md

`AGENTS.md` instructs agents to read the Canonical Pack before making product, accounting, permission, security, IA, or data-model changes.

### Governance Files

- `governance/final-decision-register.json` — Locked product decisions (D01-D18)
- `governance/10-stage-master-plan.json` — Execution plan with stage statuses
- `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md` — Agent task checklist
- `docs/execution/10_STAGE_REVIEW_LEDGER_AR.md` — Reviewer task ledger (agent-protected)

These governance files are maintained separately and referenced by canonical documents.

---

## Validation Requirements

Before any release, validate:

1. All eight canonical documents and this index exist
2. All internal links resolve
3. Every critical canonical rule has a Rule ID
4. Every Rule ID appears in the traceability matrix
5. Every release-blocking gap is assigned to a work package and release gate
6. No active legacy document still claims competing source-of-truth authority
7. `git diff --check` passes with no unexpected files changed

---

## Archive Policy

Superseded active-authority documents are moved to `docs/source-of-truth/archive/` using `git mv` to preserve history. A prominent `SUPERSEDED` banner with a link to the canonical replacement is added to the header of archived documents.

Do not delete:
- Migrations or historical financial decisions
- Audit evidence
- ADR history
- Governance log entries

---

## P7 Prohibition

**P7 (Financial Reports, Subledger Reconciliation, and Close Controls) was not started in this branch.** Any reference to S07 tasks in this pack represents planned work, not current implementation. Do not claim S07 is complete or in progress without evidence from a separate S07 implementation branch.
