# MALEK — Roadmap (Canonical)

> **Source-of-truth document.** Consolidates `docs/SINGLE_OFFICE_LAUNCH.md`, `docs/RELEASE_READINESS.md`, `docs/NEXT.md`, `docs/FEATURE_GAP_REGISTER.md`, `governance/10-stage-master-plan.json` (LOCKED), `docs/execution/10_STAGE_STATUS_AR.md` and ledgers, decisions 0001/0011, and the s08 runbook. Stage statuses below are reconciled against **git history**, not ledger self-claims (drift documented in `11_Current_Status.md`).

---

## Phase A — Single-office pilot (current priority per product decision 2026-07-27)

**Decision:** run ONE real estate office on the existing production company with the smallest safe daily-usable scope. Multi-office requirements that don't affect the first company are deferred, not blocking.

**Pilot scope:** login & single-company selection; owners/properties/units/tenants; contract creation & management; invoices, payments, receipts, VOID; expenses & maintenance; basic daily reports + print + export; settings & audit log. Owner settlements and deposits are technically available but NOT adopted as daily paths until manual operational acceptance runs. Multi-COA, additional companies, company switching deferred to multi-office phase.

**Blocking GO conditions (from launch contract):**
1. ☐ Enable Supabase Auth **Leaked Password Protection**.
2. ☐ Rotate the exposed demo-account password and terminate its old sessions.
3. ☐ Confirm fresh backup + rollback/mitigation plan before the next migration.
(All automated gates were green as of 2026-07-27; conditions remain open in docs — verify current truth before launch; the checklist in source still shows 2–3 unchecked.)

**First-real-operation supervision:** first owner settlement, first deposit, first commission payout under ADMIN supervision (per FGR-005/FGR-012 next-steps).

**Pilot-day rhythm** (from launch doc): day start — dashboard priorities/arrears/expiring contracts; then collections, expenses, maintenance; day end — daily collection report reconciliation.

## Phase B — 10-stage master plan (LOCKED_PLAN, 98 tasks)

Plan file: `governance/10-stage-master-plan.json` (sha-protected). Agent ledger: `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`; Reviewer ledger: `10_STAGE_REVIEW_LEDGER_AR.md`. Rule: legacy tables/RPCs/pages give no automatic credit; agent must prove conformity, reviewer independently verifies.

**TRUE state reconciled vs git (2026-08-07):**

| Stage | Scope | Ledger status doc | Git-verified reality | TRUE status |
|---|---|---|---|---|
| S01 | Foundation, governance, workspace cleanup | COMPLETE | #1344/#1345 merged, D01–D18 final, guards on main | **COMPLETE (reviewed)** |
| S02 | Isolation, settlement integrity, import | PARTIAL (0/10) | #1350, #1361 merged; live drift audit 2026-08-07 found 26 live-only migrations + commission RPCs missing live (fixed by #1361); CSV import fail-closed shipped | **MERGED, pending reviewer credit + drift cleanup** |
| S03 | GL, chart of accounts, periods | PARTIAL (0/10) | Engine shipped (decisions 0009/0010 migrations) but NOT wired to business RPCs; compat-view posting; no live periods | **ENGINE SHIPPED, NOT WIRED** |
| S04 | Third-party property management (owner-agency) | NOT_STARTED | Contracts/invoices/settlements legacy exist; versioned agreements, 8+2 lifecycle, signatures, frozen schedules absent | **NOT STARTED** |
| S05 | Expenses, deposits, fees, tax, refunds | PARTIAL (0/10) | Pages/services exist; unified posting paths, deposit beneficiary, configurable VAT, late fees, termination, credit notes/refunds open | **PARTIAL** |
| S06 | Master Lease (IFRS-16) | NOT_STARTED | Kernel merged #1362 (`T01…` tasks) | **KERNEL MERGED, not reviewed** |
| S07 | Reports, reconciliations, close | PARTIAL (0/10) | Kernel merged #1363; statements still subledger-based | **KERNEL MERGED, not reviewed** |
| S08 | Historical analysis | NOT_STARTED | `8e4908a7` T01–T10 merged; s08 FINAL_REPORT itself says NOT ready for independent review | **MERGED, contested (OD-11)** |
| S09 | Historical correction | NOT_STARTED | Forbidden before S08 credited | **NOT STARTED** |
| S10 | Tests, pilot, launch | NOT_STARTED | CI/test infrastructure exists; acceptance matrix, live gates, coverage-exception removal, full pilot cycle, sign-off pending | **NOT STARTED** |

Stage-order constraint: S09 blocked on S08 credit; S10 blocked on everything. Reviewer ledgers post-S01 are unchecked — independent review is the bottleneck.

## Phase C — Decided-but-unimplemented streams (parallel to Phase B)

From FEATURE_GAP_REGISTER + decisions 0001/0011 (all "product decided; implementation required"):

| Stream | Decision | Gap ID | Dependencies |
|---|---|---|---|
| Daily & open-ended contracts | ADR 0001 | FGR-008 | Contract model S04 |
| Utility billing workflow (posting targets, meters, splits, thresholds, reversals) | ADR 0001 | FGR-009 | S05 |
| Maintenance charge-target at resolution + splits | ADR 0001 | FGR-010 | S05 |
| Master-lease owner obligation schedule | ADR 0001 | FGR-011 | S06 kernel (merged) |
| Accrual/deferred revenue real pipeline | ADR 0001/0011 | FGR-013 (+PL-001 mock removal) | S03 wiring, periods |
| Financial statements on GL (parity then switch) | 0009/0010 | S03 gap audit | GL wiring |
| Reports full RPC parity | — | FGR-002 | per-report source/basis parity tests |
| Owner/tenant statements completion | — | FGR-003 | lifecycle + exports + live verification |
| Bank reconciliation completion (wizard, OFX/XLSX, dup detection, auto-match, statuses, audit) | — | FGR-006 | S02 base (merged) |
| Operation-level financial permission denial matrix | — | FGR-014 | seeded USER/MANAGER denied journeys |
| Late fees | D09 | S05-T07 | S05 |
| Early-termination canonical workflow | constitution | S05-T08 | S04/S05 |
| Credit notes & refunds | constitution | S05 | S05 |
| Due-from-Owner collection mechanism | 0011 consequence | OD-08 | owner decision first |
| Contract 8+2 lifecycle, approvals, signatures, versioned agreement snapshots, schedule freeze | constitution/0011 | S04-T01/T02/T03 | S04 |
| Multi-currency | FORGOTTEN #4 | OD-05 | owner decision first |
| S09 historical correction | plan | S09 | S08 credit |
| pgTAP for VOID/deposits/settlements expansion | QA policy | TESTING follow-ups | — |

## Phase D — Post-launch backlog & future ideas

**Known post-launch items (PL):** PL-001 deferred-revenue mocked `sampleCollections`; PL-002 zod form unification (lands/leads); PL-003 test-log cleanup; PL-004 WhatsApp auto-send.

**Future ideas (recorded, not scheduled):** owner/tenant self-service portals; multi-currency operation (OD-05); OFX/MT940 bank formats; auto-match engine for bank rec; WhatsApp full automation; subdomain-per-tenant routing; fuller English localization (phased approach accepted); real-device operator note collection (pilot day 1); richer deposit statements/installment UX.

**Rejected for now (explicitly):** React Native migration; native-only interactions; big-bang redesign; multi-office expansion before pilot sign-off; subdomain/multi-company switching in pilot; deleting history in corrections (append-only only); FULL_MONTH proration default (OD-01 context); Eastern-Arabic numerals in product UI (code settled Latin — C-06 pending doc fix).

**Idea graveyard (considered and rejected in decisions):** kept in `03_Business_Rules.md` "Rejected" list — includes client-supplied settlement amounts (P1), global account uniqueness short-term, unbalanced history deletion, browser direct financial writes.

---

## Sequencing summary (recommended reading of the plan, not a decision)

1. Close Phase A security conditions → launch single-office pilot.
2. Reviewer credit for merged work (S02/S06/S07/S08 substance check; OD-11 for S08).
3. Resolve live/repository migration drift (26 live-only / 14 repo-only; OD-14).
4. S03 GL wiring (gateway for statements/periods/S07 completion).
5. S04/S05 core workflows → FGR-008/009/010/013.
6. S06 completion; S07 completion; S08 credit → S09 → S10.
