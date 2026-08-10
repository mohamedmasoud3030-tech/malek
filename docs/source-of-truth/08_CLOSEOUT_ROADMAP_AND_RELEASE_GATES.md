# MALEK Canonical Pack — Document 8: Closeout Roadmap and Release Gates

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`  
> **Open gaps:** 23  
> **Work packages:** 7

## Purpose

This roadmap converts the 23 deduplicated gaps in Document 7 into a finite closeout program. It is not a new 10-stage master plan and does not grant stage credit. It is the implementation bridge from current repository reality to a Release Candidate.

Each gap has exactly one owning work package. Related rule IDs may span multiple canonical documents, but ownership is not duplicated.

## Release rules

| Rule ID | Canonical rule |
|---|---|
| `REL-001` | Repository implementation reality, governed stage credit, test verification and live/runtime verification are separate truths and must be reported separately. |
| `REL-002` | Every open release gap belongs to exactly one finite Work Package with explicit exit evidence; micro-PR churn is not a substitute for closing an end-to-end capability. |
| `REL-003` | Release Candidate requires all release-blocking gates green, hosted QA/runtime evidence, financial reconciliation, one-office pilot evidence and explicit sign-off. |
| `REL-004` | Historical correction/backfill cannot start merely because S08 code exists; the read-only analysis must be governed/approved first, then append-only S09 correction controls must be accepted. |

## Governed stage credit vs repository reality

The locked master plan still records:

- S01 COMPLETE
- S02 PARTIAL
- S03 PARTIAL
- S04 NOT_STARTED
- S05 PARTIAL
- S06 NOT_STARTED
- S07 PARTIAL
- S08 NOT_STARTED
- S09 NOT_STARTED
- S10 NOT_STARTED

Repository artifacts exist for portions of S02/S04/S06/S07/S08. This roadmap closes gaps based on actual code while leaving Reviewer credit untouched until the governance process grants it.

## WP-01 — Security, authorization and company isolation

**Owns:** GAP-001, GAP-002, GAP-003, GAP-018.

### Intended outcome

A coherent six-role/effective-permission model with authoritative Maker-Checker, complete sensitive-write inventory and current live company-isolation evidence.

### Included work

- Migrate `ADMIN/MANAGER/USER` deployment semantics to the approved six-role model without widening access.
- Preserve action-specific effective grants.
- Enforce creator/requester separation for designated contract/VOID/financial approvals at backend/RPC policy level.
- Inventory sensitive browser writes and close any path that bypasses canonical RPC/server ownership.
- Run current-SHA live cross-company and Auth/RLS drift checks in the authorized environment.

### Exclusions

No new business features, no historical backfill, no accounting-policy redesign.

### Exit criteria

- GAP-001/002/003/018 closed in Document 7.
- Role migration and fail-closed behavior tested.
- Cross-company negative tests pass in repository and deployed target.
- Every designated Maker-Checker action proves identity separation.
- Sensitive financial write inventory reports zero unintended browser-owned financial mutations.

## WP-02 — Owner-agency financial lifecycle

**Owns:** GAP-006, GAP-007, GAP-008, GAP-009, GAP-010, GAP-011.

### Intended outcome

A complete agent-net property-management lifecycle from invoice/collection through fee/tax/deposit/owner-receivable/settlement/refund, reconciled to GL.

### Included work

- Close RATE fee wiring from actual collection event.
- Implement/prove FIXED_MONTHLY daily accrual, catch-up and reversal.
- Complete Due-from-Owner recovery and lawful offset behavior, including post-payout refunds.
- Close deposit beneficiary/application/refund/reversal matrix.
- Finish company tax profile/code snapshots and fail-closed taxable posting.
- Complete VOID/credit-note/cash-refund/late-fee/termination event matrix.

### Exit criteria

- OWNER_IS_CREDITOR and OFFICE_IS_CREDITOR scenarios pass end-to-end.
- Example 1,000 OMR / 10% management fee produces 100 OMR office fee (plus configured tax where applicable), correct owner liability and correct cash after payout.
- Fixed monthly partial-month tests pass at 3dp.
- Owner expenses never hit 6100 when they are owner obligations.
- No deposit or refund path produces an untraceable or destructive correction.
- All related subledgers reconcile to GL controls.

## WP-03 — Contracts, onboarding, versioning and legal evidence

**Owns:** GAP-004, GAP-005, GAP-019.

### Intended outcome

A production-safe agreement/contract lifecycle with immutable signed evidence, explicit amendments and evidence-driven onboarding.

### Included work

- Authoritative owner-agreement versioning.
- Tenant contract DRAFT→REVIEW→APPROVED→SIGNED→ACTIVE lifecycle.
- Signed artifact immutability and amendment/renewal traceability.
- Seven-step property onboarding with permitted/admin evidence waivers and non-waivable identity/safety gates.
- Jurisdiction-specific legal template review before production use.

### Exit criteria

- No material retroactive mutation of signed/financial terms.
- Activation is impossible without required approval/signatures/evidence.
- Legal templates used in production are externally reviewed/approved.
- All version/amendment records are company-scoped and auditable.

## WP-04 — Independent MASTER_LEASE closeout

**Owns:** GAP-012.

### Intended outcome

A complete master-lease/principal module that is independent from owner-agency settlements and truthfully reportable.

### Included work

- Head-lease inception and measurement.
- ROU asset and lease liability.
- Payment/interest schedule, depreciation and remeasurement/modification.
- Short-term election where applicable.
- Sublease revenue and vacancy economics.
- UI/service/RPC/database/report/reconciliation wiring.

### Exit criteria

- `gl_ml_*`/S06 kernel is wired through the actual product journey.
- Master-lease balances reconcile to 1600/2500/6200/6300/4000 as applicable.
- Owner Funds Payable 2000 is not used as lease liability.
- Operational reports no longer overstate IFRS completeness.
- Governance review may then determine stage credit independently.

## WP-05 — Banking, reports, reconciliation and history

**Owns:** GAP-013, GAP-014, GAP-015, GAP-016, GAP-017.

### Intended outcome

Financial statements and operational subledgers reconcile deterministically; bank import is fail-closed; historical analysis/correction follows the locked sequence.

### Included work

- Tenant/owner/deposit/due-from-owner/commission control reconciliations.
- Trial balance, P&L, balance sheet, general ledger and complete cash-flow reporting from GL.
- Current-SHA Bank CSV preview/count/limits/3dp/ambiguity/no-partial-success proof.
- Independent S08 review and frozen approved analysis evidence.
- S09 append-only correction batches only after S08 approval.

### Exit criteria

- Every control subledger equals its GL control account within 0.001 OMR.
- Financial statements tie to posted GL and exclude VOID/CANCELLED economic effects correctly.
- Cash flow covers deposits, settlements, commissions and all bank/cash accounts.
- Invalid/ambiguous bank import rejects the whole batch.
- S08 approved/frozen before any S09 write.
- S09 uses before/after, company/period/source detail and reversible append-only corrections.

## WP-06 — UX acceptance, hosted QA and release CI

**Owns:** GAP-020, GAP-023.

### Intended outcome

The implemented product is actually operable in browser/mobile/desktop/RTL and the candidate SHA has no release-blocking CI ambiguity.

### Included work

- Autonomous browser observe→trace→repair→recheck on affected critical routes.
- Mobile/desktop/RTL acceptance for core journeys.
- Print/PDF readiness and handler-level guards.
- Loading/empty/error/permission states.
- Resolve pre-existing release-blocking test failures rather than hiding them behind baseline exceptions.
- Remove or narrow misleading coverage exclusions before release.

### Exit criteria

- Candidate SHA passes mandatory application, financial, browser and release-blocker gates.
- No unexplained baseline failures are carried into release.
- Core critical routes are observed in a hosted/runtime environment, not merely unit-tested.
- Print/PDF controls fail closed when real company/document readiness is missing.

## WP-07 — Live environment, pilot and production decision

**Owns:** GAP-021, GAP-022.

### Intended outcome

Prove the exact Release Candidate in the actual deployment environment and complete one real controlled office cycle before broader rollout.

### Included work

- Verify deployed schema/migrations/RLS/Auth Hook/functions/config/secrets for the candidate SHA.
- Backup and restore evidence.
- One-office pilot with anonymized/authorized data as appropriate.
- Daily reconciliation through a complete accounting period.
- Accountant/owner sign-off.
- Controlled production rollout decision.

### Exit criteria

- Exact deployed SHA/config recorded.
- Live cross-company isolation and critical financial lifecycles pass.
- Backup/restore rehearsal is documented.
- One complete pilot period reconciles without unexplained GL/subledger differences.
- Explicit accountant/product-owner release sign-off exists.

## Final release gates

A Release Candidate is not approved until all of the following are true:

1. Canonical decisions remain consistent and no release-blocking `CONFLICT` remains.
2. All 23 current Gap IDs are closed, superseded by evidence, or explicitly reclassified through a canonical decision.
3. Six-role/effective-permission and Maker-Checker controls are authoritative.
4. Company isolation is verified both in repository tests and the deployed target.
5. Property-management posting, reversal, fees, deposits, owner receivables and settlements reconcile.
6. MASTER_LEASE is either fully completed/reconciled or explicitly excluded from release without misleading reporting.
7. GL financial statements reconcile to all required operational control subledgers.
8. Hosted mobile/desktop/RTL/print acceptance passes.
9. Mandatory CI/release gates are green on the candidate SHA.
10. S08/S09 historical remediation sequence is respected; no unauthorized backfill exists.
11. Backup/restore and deployed configuration evidence is current.
12. One-office pilot and full-period reconciliation are complete.
13. Accountant/product-owner sign-off is recorded.

## PR strategy

Do not create one PR for every small symptom. Each Work Package should be split only where risk or migration safety genuinely requires it, while preserving one end-to-end exit target. A merged PR that leaves the Work Package exit criteria false does not close the package.

## Rollback/recovery principles

- Database migrations require forward-safe rollback/recovery instructions consistent with repository policy.
- Posted financial corrections use reversal/compensating entries, not deletion.
- Role/security changes fail closed on uncertainty.
- Pilot/deployment changes must have backup/restore and configuration rollback paths.

## Closeout completion

When all release gates pass, Document 7 becomes the evidence record of closed rules/gaps and this document becomes the release closeout record. Governed stage ledgers are then updated only by their authorized Agent/Reviewer process; this roadmap never self-grants stage completion.
