# ADR 0016 — Closeout external-decision packets (OPEN)

Status: **OPEN — awaiting authorized decisions**  
Date: 2026-08-15  
Repository reality baseline: `main@edf57aae5003d536afb7eb0b212790bb57172751`

This record bundles the three remaining decisions that cannot be made by an
implementation agent. None of them is a coding question; each requires the
named authority. All independent engineering continues while they are open.

---

## DP-1 — MASTER_LEASE release inclusion/exclusion (GAP-012)

**Authority:** Product Owner.

**Exact question.** Is the independent MASTER_LEASE (principal-accounting)
module included in this Release Candidate, or explicitly excluded?

**Why it blocks release.** `PRD-003`, `OPS-002`, `FIN-002`, `FIN-020` define a
separate principal-accounting model (ROU asset, lease liability, schedules).
Locked decision D07 defines the model but does **not** say whether it is in the
first Release Candidate. GAP-012 is a BLOCKER. The canonical rules forbid
either silently shipping a half-wired module or deleting valid history.

**Existing evidence.**
- `gl_ml_*` / `src/s6/**` kernels and `supabase/migrations/20260809020000_s06_master_lease_gl_lifecycle.sql`
  exist and are tested (`master_lease_gl_lifecycle.sql` pgTAP, S06 TypeScript tests).
- Governed stage S06 is `NOT_STARTED`; there is no complete product journey
  (no full classification/measurement/liability/depreciation/termination UI +
  reporting + reconciliation).
- Document 7 records GAP-012 as BLOCKER with truthful-labeling constraints.

**Options.**
1. **EXCLUDE from this RC** — mark routes unavailable or clearly non-release,
   remove any misleading dashboard/report copy, preserve code/history, no
   destructive deletion. Unblocks the RC path immediately.
2. **INCLUDE** — complete the full product journey (classification, initial
   ROU measurement, liability schedule, payments, interest, depreciation,
   remeasurement, partial/full termination, sublease/vacancy economics,
   reporting, reconciliation of 1600/2500/6200/6300/4000, browser workflow)
   on the existing `gl_ml_*` kernels, plus professional accounting review of
   the labeling.

**Consequences.** Option 1 defers a large surface and keeps the RC honest.
Option 2 adds significant scope and requires professional accounting review
before any "IFRS-compliant" wording (which is currently correctly avoided).

**Recommended technical default.** EXCLUDE from this RC; keep the kernels and
tests in place; record the exclusion truthfully. MASTER_LEASE then ships in a
later governed release after its own product journey is completed.

**Work that continues independently.** Everything in WP-01/02/03/05/06/07 that
does not depend on MASTER_LEASE reporting.

---

## DP-2 — AI Assistant information architecture (GAP-023)

**Authority:** Product Owner.

**Exact question.** Is the AI Assistant a true separate `/ai-assistant` route
(canonical `PRD-008` / `UX-007`), or does the Product Owner formally approve
the implemented Dashboard/global overlay model?

**Why it blocks release.** `PRD-008` and `UX-007` require a separate route that
is not part of accounting authority. The current implementation treats
`/ai-assistant` as a legacy deep-link that redirects to
`/dashboard?globalAction=ai-assistant` and opens a global overlay. This is
recorded as `CONFLICT` (GAP-023) and keeps release gate G2 open.

**Existing evidence.**
- Canonical rules: `PRD-008` (01_PRODUCT_CHARTER_AND_SCOPE.md), `UX-007`
  (06_UX_IA_AND_DESIGN_CONTRACT.md), Document 6 route-disposition matrix.
- Implementation: `route-tree.ts` + `ai-assistant-global-action.tsx`
  (global overlay). No primary navigation item exists for AI.
- No locked decision (D01–D18) chooses the overlay over the separate route.

**Options.**
1. **Implement the true separate route** — real `/ai-assistant` page, verified
   deep-link/back/close/focus behavior, read-only, no financial authority.
2. **Approve the global overlay** — update `PRD-008`/`UX-007` through the
   authorized governance process, then make route behavior and docs match.

**Consequences.** Option 1 conforms to the existing canonical rules and closes
the conflict by construction. Option 2 requires a canonical-rule change with
owner approval and a re-review of Document 6.

**Recommended technical default.** Option 1 (implement the separate route), as
it is the already-approved canonical rule. The agent will not silently choose
between the two.

**Work that continues independently.** All other WP-06 browser/RTL/print
acceptance; the assistant remains read-only with no financial posting
authority in either option.

---

## DP-3 — Oman production legal templates (GAP-019)

**Authority:** Jurisdiction-specific legal counsel (Oman).

**Exact question.** Are the production contract/agreement templates and their
evidence/retention requirements legally fit for use in Oman?

**Why it blocks release.** GAP-019 is `EXTERNAL`: signed documents may be
operationally present but legally unusable. Software tests cannot produce a
legal approval, and the agent must not invent Omani legal wording.

**Existing evidence.**
- Private, company-scoped document platform: Storage buckets/policies,
  `document_reference_trigger_regression.sql`, vault/attachments/contract
  document services, `pdfService.ts`, document/print evidence artifacts
  (`evidence/wp06-document-output/`).

**External-review packet contents requested.**
- Document type (owner agreement, tenant contract, receipt, statement, etc.)
- Current template and where it lives
- Business purpose
- Variables substituted at generation time
- Signature/evidence requirements
- Retention expectation
- Unresolved legal questions (wording, mandatory clauses, evidence retention)

**Recommended technical default.** Engineering can complete the
template/version/evidence infrastructure; production templates stay blocked
until authorized jurisdiction-specific review. No legal approval is claimed
from software tests.

**Work that continues independently.** All template/version/evidence
engineering that does not assert legal validity.

---

## Non-goals

- These packets do **not** change any canonical rule.
- They do **not** grant governed stage credit.
- They do **not** authorize production mutation, S09 historical correction, or
  pilot sign-off (those remain governed by D17/D18 and the Reviewer/Accounting
  ledgers).
