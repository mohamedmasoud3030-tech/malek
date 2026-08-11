# MALEK Canonical Pack — Document 8: Closeout Roadmap and Release Gates

> **Status:** CANONICAL
> **Baseline:** `main@8ada4e7eb81fbad3d19f5603626f699b5e10d8d5`
> **Open gaps:** 23
> **Work packages:** 7

## Purpose

This roadmap converts the deduplicated Gap Register in Document 7 into a finite closeout program. It does not replace the governed 10-stage plan, grant Reviewer credit or assign dates/effort without evidence. A merged PR closes a gap only when the stated exit evidence is true.

## Release rules

| Rule ID | Canonical rule |
|---|---|
| `REL-001` | Repository implementation reality, governed stage credit, test verification and live/runtime verification are separate truths and must be reported separately. |
| `REL-002` | Every open release gap belongs to exactly one finite Work Package with explicit exit evidence; micro-PR churn is not a substitute for closing an end-to-end capability. |
| `REL-003` | Release Candidate requires all release-blocking gates green, hosted QA/runtime evidence, financial reconciliation, one-office pilot evidence and explicit sign-off. |
| `REL-004` | Historical correction/backfill cannot start merely because S08 code exists; the read-only analysis must be governed/approved first, then append-only S09 correction controls must be accepted. |

## Current governed credit

`S01 COMPLETE; S02 PARTIAL; S03 PARTIAL; S04 NOT_STARTED; S05 PARTIAL; S06 NOT_STARTED; S07 PARTIAL; S08 NOT_STARTED; S09 NOT_STARTED; S10 NOT_STARTED`.

Repository implementation for portions of S02/S04/S06/S07/S08 is acknowledged in Document 7. This roadmap neither erases it nor grants stage credit for it.

## Work-package dependency map

| Work package | Primary dependencies | Unblocks |
|---|---|---|
| WP-01 Security/company isolation | approved role mapping; authorized live environment for GAP-003 | all sensitive business/financial approvals and live release proof |
| WP-02 Owner-agency finance | WP-01 authorization; canonical GL/periods; professional tax input for GAP-010 | WP-05 control reconciliations and pilot |
| WP-03 Contracts/onboarding/legal evidence | WP-01; document platform; legal review | trustworthy WP-02 source terms and pilot contracts |
| WP-04 MASTER_LEASE | WP-01; Stage-3 GL; explicit release inclusion decision | WP-05 master-lease reporting or truthful exclusion |
| WP-05 Reports/history/banking | WP-02/03/04 source integrity; S08 approval before S09 | Release Candidate financial evidence |
| WP-06 UX/hosted acceptance | implementable candidate from WP-01..05; product decision for AI IA | usable Release Candidate |
| WP-07 Live/pilot/launch | all release-blocking implementation gaps; exact candidate SHA | production launch decision |

## WP-01 — Security, authorization and company isolation

**Included Gap IDs:** GAP-001, GAP-002, GAP-003, GAP-018.
**Intended outcome:** one fail-closed six-role/effective-permission model, uniform Maker-Checker for designated actions, zero unintended sensitive browser writes, and current live company-isolation proof.

**Explicit exclusions:** no accounting-policy redesign, no business-feature expansion, no historical correction, no production data mutation outside an approved verification procedure.

**Dependencies:** product-owner mapping from existing three roles/data to six roles; inventory of designated approvals; authorized QA/live credentials for GAP-003.

**Data/migration impact:** additive/controlled role enum or role-value migration, JWT/user metadata compatibility, RLS/RPC permission updates and possible backfill of role assignments. Migration must default unknown/legacy values to least privilege.

**Security/accounting risk:** privilege widening, account lockout, cross-company access, self-approval and browser bypass of financial controls.

**Required implementation layers:** Auth/JWT → role/capability model → RLS/RPC → UI affordances → audit/idempotency → tests → deployed negative tests.

**Smallest meaningful verification:** migrate representative users for each role; prove every capability matrix row; reject same-actor approval; run two-company SELECT/INSERT/UPDATE/DELETE/RPC negatives; run the sensitive-write inventory/guard.

**Exit criteria:**

- GAP-001/002/003/018 are closed in Document 7 with exact evidence.
- Legacy/unknown roles fail closed and no role receives an unintended permission.
- Every designated contract, VOID, settlement and financial approval enforces identity separation, including audited exception semantics if approved.
- Repository and exact deployed-target cross-company tests pass.
- No sensitive financial table has an unintended browser-owned mutation path.

**Rollback/recovery:** preserve old role values until forward migration is verified; use a reversible compatibility mapping; security rollback fails closed; never force-update production roles without export/backup and restore mapping.

**Release gates affected:** G2 canonical conflicts, G3 company isolation, G6 permissions/Maker-Checker, G9 CI, G11 live environment.

## WP-02 — Owner-agency financial lifecycle

**Included Gap IDs:** GAP-006, GAP-007, GAP-008, GAP-009, GAP-010, GAP-011.
**Intended outcome:** one authoritative agent-net lifecycle from obligation/collection through fees, tax, deposits, owner receivables, settlements, VOID/credit/refund and GL reconciliation.

**Explicit exclusions:** MASTER_LEASE, historical backfill, generic ERP accounting, unapproved statutory/legal assumptions.

**Dependencies:** WP-01 sensitive-action authority; Stage-3 GL/periods; contract snapshots from WP-03 where terms are source data; approved company tax configuration.

**Data/migration impact:** likely replacement/hardening of legacy deposit 2dp/direct-write paths, fee-accrual events, owner-receivable/recovery records, tax snapshots and reversal references. Existing posted history is not rewritten.

**Security/accounting risk:** misstated office revenue/owner payable, double collection/fee/deposit use, illegal offset, OMR rounding drift, tax misstatement and destructive refunds.

**Required implementation layers:** finance UI → typed service/event mapper → narrow idempotent RPC → subledger/GL tables → RLS/permissions/audit → financial tests → hosted lifecycle evidence.

**Smallest meaningful verification:** two golden paths (OWNER and OFFICE creditor), RATE and partial-month FIXED fee, owner expense/recovery/offset, full deposit receive/apply/refund/reverse, tax-config missing/active, receipt VOID/credit/cash refund, all at 3dp with retry/concurrency cases.

**Exit criteria:**

- Example 1,000.000 OMR collection with 10% RATE produces 100.000 fee before configured tax, correct 2000 owner position and correct payout.
- FIXED_MONTHLY daily accrual/catch-up/reversal is idempotent and period-correct.
- Owner obligations hit 1300 rather than 6100 and never force 2000 negative.
- Deposit transactions are RPC-only, immutable/compensating, 3dp and reconciled to 2200 by beneficiary.
- Taxable posting blocks incomplete profiles and snapshots configured code/rate/amount.
- VOID/credit/refund/termination paths preserve history and reconcile subledger/GL/report totals.

**Rollback/recovery:** forward-safe migrations; dual-read only where explicitly temporary and reconciled; no posted-row delete/update; use reversal/compensating events; preserve request/source identity during cutover.

**Release gates affected:** G2, G4 posting/reversal, G5 GL/subledger reconciliation, G6, G7 statements/reports, G10 printable documents.

## WP-03 — Contracts, onboarding, versioning and legal evidence

**Included Gap IDs:** GAP-004, GAP-005, GAP-019.
**Intended outcome:** a production-safe owner-agreement/property/tenant-contract chain with immutable commercial/legal versions, enforced evidence gates and reviewed production templates.

**Explicit exclusions:** accounting event implementation owned by WP-02/04, owner/tenant portals, unrelated CRM expansion.

**Dependencies:** WP-01 roles/Maker-Checker; document Storage platform; jurisdiction-specific legal review.

**Data/migration impact:** client types/services for existing agreement-version and contract approval schema; possible property onboarding/evidence/waiver tables; immutable signed-document version references.

**Security/accounting risk:** silent retroactive term change, wrong collection role/fee snapshot, unsigned activation, missing safety evidence and cross-company document exposure.

**Required implementation layers:** onboarding/contract UI → services → version/approval/document RPCs → company constraints/RLS → audit → tests → hosted signed-version journey.

**Smallest meaningful verification:** create version 1, submit/approve/sign/activate contract as distinct users, create future version 2, prove contract 1 snapshot unchanged, reject retroactive edit/self-approval/missing evidence/cross-company document access.

**Exit criteria:**

- Current UI invokes the canonical agreement-version and contract approval/activation path.
- No material signed/financial term can be silently edited.
- Seven-step onboarding has property-type templates, audited admin waivers and non-waivable identity/safety gates.
- Signed artifacts and amendments retain exact version/company/actor evidence.
- Production legal templates/evidence rules have external approval.

**Rollback/recovery:** preserve existing agreement/contract identities and signed artifacts; migration rollback never deletes versions/documents; disable activation on uncertainty rather than bypassing gates.

**Release gates affected:** G1 canonical approval, G2, G6, G8 browser/RTL acceptance, G10 documents, G12 pilot.

## WP-04 — Independent MASTER_LEASE closeout

**Included Gap IDs:** GAP-012.
**Intended outcome:** either a fully independent, reconciled principal-accounting module or an explicit release exclusion with no misleading IFRS/product claims.

**Explicit exclusions:** owner-agency settlements/OFP as lease accounting, historical backfill, legal/accounting certification by software tests.

**Dependencies:** WP-01; canonical GL/periods; professional accounting decisions for classification, rate, short-term election, modification and presentation; product release-inclusion decision.

**Data/migration impact:** wire existing measurement/lifecycle tables and `gl_ml_*` RPCs to services/UI/report adapters; any additive disclosure/classification fields require company-scoped migration and rollback notes.

**Security/accounting risk:** using 2000 as lease liability, incorrect ROU/liability/interest/depreciation, double posting, or claiming full IFRS compliance from a kernel.

**Required implementation layers:** classification/UI → schedule/service → `gl_ml_*` RPC/database → permissions/audit → reporting/reconciliation → tests → hosted acceptance.

**Smallest meaningful verification:** initial measurement, scheduled payment/interest/depreciation, remeasurement, partial/full termination and sublease revenue for one lease; reconcile 1600/2500/6200/6300/4000 and current/non-current split.

**Exit criteria:**

- The actual product journey uses the existing kernels with stable event ids and authoritative schedules.
- Owner Funds Payable is never used as lease liability.
- Disclosure and GL balances reconcile at 0.001 OMR.
- Reports label implemented scope truthfully and pass professional review where required.
- If excluded, routes/copy/reports cannot imply release availability or IFRS completeness.

**Rollback/recovery:** no rewrite of posted measurements; modifications/terminations are subsequent events; feature availability can fail closed while preserving schedules/posted history.

**Release gates affected:** G1/G2, G4/G5, G7, G8, G12.

## WP-05 — Banking, reports, reconciliation and history

**Included Gap IDs:** GAP-013, GAP-014, GAP-015, GAP-016, GAP-017.
**Intended outcome:** deterministic control-account/financial-statement reconciliation, fail-closed banking, approved historical analysis and only then controlled append-only correction.

**Explicit exclusions:** operational source fixes owned by WP-02/03/04; unscoped historical UPDATE/DELETE; cosmetic report redesign without accounting proof.

**Dependencies:** trustworthy source lifecycles from WP-02/03/04; accounting periods; authorized live data for S08; Reviewer approval before S09.

**Data/migration impact:** report adapters/queries and reconciliation evidence tables where necessary; S09 migrations are prohibited until GAP-015 closes. Historical corrections are new batches only.

**Security/accounting risk:** balanced-looking but incomplete statements, missing cash movements, duplicate/partial bank import, or correcting the wrong tenant/company/period/source.

**Required implementation layers:** report/bank UI → services → report/import/reconciliation RPCs → GL/subledgers/RLS → audit → financial/QA tests → frozen evidence.

**Smallest meaningful verification:** tie 1201/2000/1300/2200/2300 to detailed source rows; prove trial balance/P&L/balance sheet/GL/cash flow; reject one invalid/ambiguous bank row atomically; freeze S08 sample and prove no writes.

**Exit criteria:**

- Every required subledger equals its GL control within 0.001 OMR with explained exception rows.
- Statements derive from POSTED GL; VOID/CANCELLED/reversal treatment and report basis are explicit.
- Cash flow covers every 1111/1120 movement including deposits, settlements and commissions.
- Bank import rejects the entire invalid/ambiguous batch and preserves request/source identity.
- S08 is independently reviewed/frozen/approved before any S09 code or write.
- S09, when authorized, is company/period/source-scoped, append-only, reversible and evidenced before/after.

**Rollback/recovery:** reports are read-only; imports use atomic rollback; historical writes use new reversal/correction batches; an S08/S09 gate failure stops writes without changing the approved baseline.

**Release gates affected:** G1/G2, G5, G7, G9, G12.

## WP-06 — UX contract, hosted acceptance and browser quality

**Included Gap IDs:** GAP-020, GAP-023.
**Intended outcome:** critical journeys work in hosted desktop/mobile/RTL/print contexts, and the AI Assistant IA has one approved, implemented contract.

**Explicit exclusions:** changing accounting/security rules to make screens easier; counting preview availability or component tests as browser acceptance.

**Dependencies:** a stable candidate from WP-01..05; hosted QA data/credentials; product-owner decision to keep a true separate AI route or canonically approve the global overlay model.

**Data/migration impact:** none expected for layout/route acceptance; any AI-route decision must not change financial authority. Defects discovered in backend/data return to their owning WP.

**Security/accounting risk:** hidden permission bypass, wrong company/money display, failed print totals, inaccessible approval or a route/overlay contract that confuses future implementation.

**Required implementation layers:** route/shell/shared UI → services/backend as discovered → permission states → browser tests/artifacts → canonical traceability.

**Smallest meaningful verification:** run the complete Browser Readiness suite to completion; manually/automatically observe critical routes at phone and desktop sizes in RTL; print representative financial/legal documents; verify AI deep-link/back/close/focus behavior after the IA decision.

**Exit criteria:**

- Browser Readiness and required seeded/authenticated staging jobs pass on the candidate SHA; cancelled/skipped is not pass.
- Critical routes have intentional loading/empty/error/permission states and no console/network failures.
- Desktop sidebar and mobile Menu + Search behavior match the route contract; no duplicate/hidden competing page authority remains.
- Arabic/RTL, keyboard/focus, touch targets and print/PDF output are accepted.
- `PRD-008/UX-007` either match a true `/ai-assistant` route or are changed by explicit canonical owner decision to the global overlay model.

**Rollback/recovery:** route changes retain intentional compatibility redirects; UI rollback does not bypass backend controls; preserve browser traces/screenshots for regression diagnosis.

**Release gates affected:** G1/G2, G8 browser/mobile/RTL, G9 CI/browser, G10 documents.

## WP-07 — Live environment, pilot and production decision

**Included Gap IDs:** GAP-021, GAP-022.
**Intended outcome:** prove the exact Release Candidate in the authorized deployment and complete one reconciled real-office cycle before broader rollout.

**Explicit exclusions:** production mutation without authorized procedure, treating ephemeral CI or a preview as live proof, bypassing unresolved release blockers.

**Dependencies:** all applicable prior WPs; exact candidate SHA; live/QA credentials; backup/restore authority; accountant/product-owner/pilot-office participation.

**Data/migration impact:** deploy only reviewed migrations/config; record the exact ledger and configuration. Pilot data handling must be authorized and recoverable.

**Security/accounting risk:** schema/Auth Hook/RLS drift, secret/config failure, unrecoverable data, and real-money/subledger mismatch.

**Required implementation layers:** deployment/config → Auth/RLS/functions/Storage → critical hosted journeys → monitoring/backup/restore → pilot operations/reconciliation → sign-off.

**Smallest meaningful verification:** record deployed SHA; verify migration ledger/Auth Hook/company claim/RLS/functions/Storage; restore a backup rehearsal; operate and reconcile one controlled daily cycle before the full pilot period.

**Exit criteria:**

- Exact deployed SHA/config/migration/Auth Hook evidence is recorded.
- Live two-company and critical financial negative/positive journeys pass.
- Secrets, Storage, observability and backup/restore are verified.
- One complete office period reconciles daily and at close with no unexplained control difference.
- Accountant, product owner and pilot office record explicit release/no-release decision.

**Rollback/recovery:** documented configuration/deployment rollback, tested backup restore, forward-safe database recovery and controlled pilot pause. Posted financial data is corrected through reversal, never purge.

**Release gates affected:** G3/G4/G5/G6/G7/G8/G10/G11/G12/G13.

## Final release gates

| Gate | Required evidence | Baseline state |
|---|---|---|
| G1 — Canonical decisions approved | no unresolved owner/accounting/legal ambiguity for release scope | PARTIAL; AI IA conflict and external legal/tax decisions remain |
| G2 — No release-blocking conflict | all `CONFLICT` rows resolved explicitly | FAIL: roles, AI IA and deposit precision conflict remain |
| G3 — Company isolation | repository + exact deployed negative tests | PARTIAL: repository/ephemeral pass; live absent |
| G4 — Posting and reversal | owner-agency/master-lease included scope passes event/retry/reversal tests | PARTIAL |
| G5 — GL/subledger reconciliation | 1201/2000/1300/2200/2300 and included lease controls tie within 0.001 | FAIL/open |
| G6 — Permissions/Maker-Checker | six roles/effective grants/designated approvals verified | FAIL/open |
| G7 — Financial reports | GL statements and cash flow complete/reconciled | PARTIAL/open |
| G8 — Mobile/desktop/RTL/browser | completed hosted Browser Readiness and acceptance evidence | FAIL: run cancelled; staging skipped |
| G9 — Main CI/release checks | mandatory code/database/governance/browser checks green on candidate | PARTIAL: PR #1430 code/database/governance passed; browser did not |
| G10 — Printable documents | representative legal/financial documents visually and numerically accepted | NOT PROVEN |
| G11 — Live environment/restore | deployed SHA, schema, Auth, RLS, secrets, Storage, monitoring and restore proof | NOT PROVEN |
| G12 — One-office pilot | complete operating/accounting period reconciled | NOT STARTED/evidenced |
| G13 — Release Candidate decision | explicit accountant/product-owner approval after prior gates | NOT STARTED/evidenced |

## PR and change strategy

- Close a complete capability chain, not one PR per cosmetic symptom.
- Split a Work Package only where migration/security/review risk requires it; retain one owning Gap ID and exit target.
- Each code-changing PR cites affected Rule/Gap IDs and updates Documents 7/8 when evidence/status changes.
- No implementation PR self-grants governed stage credit.
- No dates or effort estimates are authoritative until derived from an approved, evidence-based execution plan.

## Closeout completion

When every applicable gate passes, Document 7 becomes the final rule/gap evidence record and this document records the Release Candidate decision. Reviewer/stage ledgers are updated only by their authorized process; this roadmap never marks them complete itself.
