# MALEK Canonical Pack — Document 7: Implementation Traceability and Reality

> **Status:** CANONICAL  
> **Repository reality baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`  
> **Rule count:** 77  
> **Gap count:** 23

## How to read this document

This matrix describes repository reality without granting governance credit. `governance/10-stage-master-plan.json`, the Agent checklist and Reviewer ledger remain the authority for governed stage credit.

A stage may therefore have repository implementation while its governed status remains `NOT_STARTED` or `PARTIAL`. This is deliberate and prevents both false completion and false “nothing exists” claims.

### Status vocabulary

- `VERIFIED_IMPLEMENTED` — implementation plus focused repository verification evidence.
- `IMPLEMENTED_UNVERIFIED` — implementation exists but required verification is incomplete/stale.
- `PARTIAL` — only part of the end-to-end contract exists.
- `NOT_IMPLEMENTED` — conforming implementation was not found.
- `CONFLICT` — current implementation conflicts with an approved canonical rule.
- `BLOCKED_EXTERNAL` — live/external authority is required.

`VERIFIED_IMPLEMENTED` never means “production deployed” or “governed stage COMPLETE” by itself.

## Focused brownfield verification record

The documentation-only audit previously executed focused repository verification against the same application baseline. No application/SQL/dependency changes are introduced by this canonical-pack branch.

- Navigation/permissions + Stage 3 + S04 + S06 + S08 focused suites: **139/139 passed**.
- Company-isolation and permission-request lifecycle focused suites: **38/38 passed**.
- Total focused tests: **177/177 passed**.
- TypeScript project build: passed using repository-pinned pnpm `10.11.1`.
- Production Vite build: passed using repository-pinned pnpm `10.11.1`.
- Documentation/governance focused checks and `git diff --check`: passed in the completed local audit.

These results establish repository-contract evidence only. Hosted browser, live Supabase, deployed Auth configuration, production secrets, backups and Reviewer sign-off remain separate.

## 77-rule traceability matrix

| Rule ID | Canonical rule (short) | Repository evidence | Status | Gap | Work package |
|---|---|---|---|---|---|
| PRD-001 | Arabic-first, RTL, multi-company product | `route-contract.ts`; company-scoped schema/RLS history | VERIFIED_IMPLEMENTED | — | — |
| PRD-002 | Property-office operating customer | implemented property/people/contracts/financial routes | VERIFIED_IMPLEMENTED | — | — |
| PRD-003 | Owner-agency + separate master-lease models | S04/S06 migrations/tests; incomplete full lifecycle | PARTIAL | GAP-012 | WP-04 |
| PRD-004 | Oman/OMR 3dp baseline | `accountingDomain.ts` OMR precision; DB monetary controls | VERIFIED_IMPLEMENTED | — | — |
| PRD-005 | No silent generic ERP/investment/CRM scope expansion | canonical IA exists; legacy adjacent routes remain | IMPLEMENTED_UNVERIFIED | — | — |
| PRD-006 | Core properties/people/contracts/finance/services/reports/settings | `route-contract.ts` | VERIFIED_IMPLEMENTED | — | — |
| PRD-007 | Reports separate top-level workspace | `/reports` route contract + IA tests | VERIFIED_IMPLEMENTED | — | — |
| PRD-008 | AI Assistant separate from accounting authority | `/ai-assistant` route contract | VERIFIED_IMPLEMENTED | — | — |
| PRD-009 | Production-ready requires complete evidence chain | code/test layers exist; hosted/runtime gates incomplete | PARTIAL | GAP-020 | WP-06 |
| PRD-010 | One-office reconciled pilot before broad release | no completed pilot/sign-off evidence | NOT_IMPLEMENTED | GAP-022 | WP-07 |
| OPS-001 | Owner-agency is agent-net | D01/D02; S04 GL kernel/tests | IMPLEMENTED_UNVERIFIED | GAP-006 | WP-02 |
| OPS-002 | MASTER_LEASE separate principal workflow | S06 lifecycle migration/tests exist; full product wiring incomplete | PARTIAL | GAP-012 | WP-04 |
| OPS-003 | Explicit OWNER/OFFICE collection role | D01; agreement/accounting migrations and S04 tests | VERIFIED_IMPLEMENTED | — | — |
| OPS-004 | Controlled property onboarding/evidence/waivers | D12 decision; full enforced journey not proven | PARTIAL | GAP-005 | WP-03 |
| OPS-005 | Owner-agreement material changes are versioned | D13; legacy/current update paths coexist | PARTIAL | GAP-004 | WP-03 |
| OPS-006 | Contract DRAFT→REVIEW→APPROVED→SIGNED→ACTIVE | ADR 0015/D11; UI/lifecycle pieces exist, full backend proof incomplete | PARTIAL | GAP-004 | WP-03 |
| OPS-007 | Maker-Checker for material approvals | accepted decision; complete backend identity separation absent | NOT_IMPLEMENTED | GAP-002 | WP-01 |
| OPS-008 | Invoice/AR follows collection_role | D01; S04 posting contracts | VERIFIED_IMPLEMENTED | — | — |
| OPS-009 | RATE on collection; FIXED_MONTHLY daily accrual | D02; partial posting surfaces | PARTIAL | GAP-006; GAP-007 | WP-02 |
| OPS-010 | Controlled collection/void/refund lifecycle | receipt/reversal infrastructure exists; complete lifecycle not proven | PARTIAL | GAP-011 | WP-02 |
| OPS-011 | Atomic settlement reservations/no double use | FA003 reservation migrations/RPCs + focused repository tests | VERIFIED_IMPLEMENTED | — | — |
| OPS-012 | Owner expense = Due from Owner; lawful offset | D04; GL support exists; recovery/offset journey incomplete | PARTIAL | GAP-008 | WP-02 |
| OPS-013 | Deposit liability/application/reversal | D05; deposit tables/RPCs exist; full beneficiary/refund path incomplete | PARTIAL | GAP-009 | WP-02 |
| OPS-014 | Bank CSV preview + fail-closed | D16; banking/import surfaces exist; full current proof incomplete | PARTIAL | GAP-017 | WP-05 |
| OPS-015 | Read-only analysis before append-only correction | S08 repository evidence exists; S09 not implemented/approved | PARTIAL | GAP-015; GAP-016 | WP-05 |
| DOM-001 | Company scope on owned aggregates | RLS/RPC hardening + company isolation focused tests | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| DOM-002 | Property/unit/land relationships | schema/types/routes | VERIFIED_IMPLEMENTED | — | — |
| DOM-003 | People foundation with owner/tenant profiles | people/owner/tenant feature/domain routes | VERIFIED_IMPLEMENTED | — | — |
| DOM-004 | Versioned owner agreements | decision locked; complete version model not end-to-end | PARTIAL | GAP-004 | WP-03 |
| DOM-005 | Contract lifecycle + immutable signed evidence | contract UI/docs exist; authoritative lifecycle incomplete | PARTIAL | GAP-004 | WP-03 |
| DOM-006 | Invoices/payments/receipts/allocations distinct | schema/services and receipt/payment cutover work | VERIFIED_IMPLEMENTED | — | — |
| DOM-007 | Settlement source links/reservations | FA003 reservation tables/RPCs | VERIFIED_IMPLEMENTED | — | — |
| DOM-008 | Deposit transaction subledger | schema/migrations exist; lifecycle incomplete | PARTIAL | GAP-009 | WP-02 |
| DOM-009 | Accounts/periods/batches/lines GL model | Stage-3 migrations/domain/tests | VERIFIED_IMPLEMENTED | — | — |
| DOM-010 | Audit/documents/archive preserve history/scope | audit/document infrastructure exists; legal-template/live storage proof incomplete | IMPLEMENTED_UNVERIFIED | GAP-019 | WP-03 |
| FIN-001 | Agent-net owner-agency accounting | D01; S04 posting kernel/tests | VERIFIED_IMPLEMENTED | GAP-006 | WP-02 |
| FIN-002 | MASTER_LEASE principal accounting | S06 kernel/tests exist, product/report integration incomplete | PARTIAL | GAP-012 | WP-04 |
| FIN-003 | OWNER creditor: operational AR; collection→2000 | D01; `gl_pm_*` S04 tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-004 | OFFICE creditor: 1201/2000 then cash/1201 | D01; S04 posting tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-005 | RATE management fee on collection | D02; GL functions exist, complete user-event wiring not proven | PARTIAL | GAP-006 | WP-02 |
| FIN-006 | FIXED_MONTHLY daily accrual | D02; incomplete scheduled/end-to-end accrual proof | PARTIAL | GAP-007 | WP-02 |
| FIN-007 | Owner expense posts to 1300 not 6100 | D04; S04/FA accounting surfaces and tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-008 | Legal offset + no negative owner payable | D04/ADR0015; recovery/offset workflow incomplete | PARTIAL | GAP-008 | WP-02 |
| FIN-009 | Deposit receipt remains 2200 liability | D05; deposit/account definitions | VERIFIED_IMPLEMENTED | — | — |
| FIN-010 | Deposit application by beneficiary + compensating reversal | D05; partial application/reversal implementation | PARTIAL | GAP-009 | WP-02 |
| FIN-011 | Broker commission 6110/2300 then payable clearing | canonical accounts + commission GL migration/tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-012 | Versioned tax configuration; no hard-coded statutory rate | D08; configuration work incomplete end-to-end | PARTIAL | GAP-010 | WP-02 |
| FIN-013 | OMR 3dp server authority | `OMR_PRECISION=3`; Stage-3 DB/posting controls | VERIFIED_IMPLEMENTED | — | — |
| FIN-014 | Exactly 18 required canonical accounts | `REQUIRED_ACCOUNT_DEFINITIONS`; Stage-3 provisioner | VERIFIED_IMPLEMENTED | — | — |
| FIN-015 | Balanced controlled journal batches; no free browser journals | Stage-3 engine/RPC/security tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-016 | Idempotent/source-traceable posting/reversal | Stage-3 posting/reversal/concurrency evidence | VERIFIED_IMPLEMENTED | — | — |
| FIN-017 | OPEN/SOFT/HARD periods + late posting | D06; period/reversal security tests | VERIFIED_IMPLEMENTED | — | — |
| FIN-018 | Posted history append-only; reversal/adjustment only | GL triggers/RPCs + D15/D17 | VERIFIED_IMPLEMENTED | — | — |
| FIN-019 | GL statements + mandatory subledger reconciliation | GL exists; full reconciliations/statements incomplete | PARTIAL | GAP-013; GAP-014 | WP-05 |
| FIN-020 | Full master-lease ROU/liability/interest/depreciation/reporting | S06 repository kernel exists; E2E/financial-statement proof incomplete | PARTIAL | GAP-012 | WP-04 |
| SEC-001 | Active-company context for operations | Auth/company helpers + multi-company migrations | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-002 | RLS company isolation | RLS migrations/tests across domains | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-003 | SECURITY DEFINER revalidates company/scope | hardening migrations/audit tests | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-004 | Six approved product roles | ADR0015 says six; `permissions.ts` implements three | CONFLICT | GAP-001 | WP-01 |
| SEC-005 | Capability/effective-permission authorization | typed permission catalog + `canAccess` | VERIFIED_IMPLEMENTED | — | — |
| SEC-006 | Write posture honors effective grants | `getWriteAccessState`; focused permission tests | VERIFIED_IMPLEMENTED | — | — |
| SEC-007 | Revoke→re-request does not reuse historical approval | permission-request lifecycle implementation/tests | VERIFIED_IMPLEMENTED | — | — |
| SEC-008 | Backend Maker-Checker identity separation | target accepted; complete designated-action enforcement not proven | NOT_IMPLEMENTED | GAP-002 | WP-01 |
| SEC-009 | Sensitive financial writes RPC/server owned | Stage-3 GL service boundaries/guards; remaining sensitive-path audit required | IMPLEMENTED_UNVERIFIED | GAP-018 | WP-01 |
| SEC-010 | Live config/secrets/storage/audit fail closed | repository controls exist; deployment/Auth/secrets/live drift not proven | BLOCKED_EXTERNAL | GAP-021 | WP-07 |
| UX-001 | Arabic/RTL responsive experience | app shell/features/design decisions/tests | VERIFIED_IMPLEMENTED | — | — |
| UX-002 | Route contract is canonical IA | `route-contract.ts`, route-tree, compatibility tests | VERIFIED_IMPLEMENTED | — | — |
| UX-003 | Financial hub + `/finance/*` view bindings | route contract; financial hub | VERIFIED_IMPLEMENTED | — | — |
| UX-004 | Reports remains independent | `/reports` contract/IA | VERIFIED_IMPLEMENTED | — | — |
| UX-005 | People root owns people/owners/tenants | route contract/navigation tests | VERIFIED_IMPLEMENTED | — | — |
| UX-006 | Services/Maintenance + Service Providers | baseline service-provider domain/routes/permissions | VERIFIED_IMPLEMENTED | — | — |
| UX-007 | AI Assistant separate route | route contract | VERIFIED_IMPLEMENTED | — | — |
| UX-008 | Unified components/states/format/print guards/accessibility | broad design work exists; hosted/browser acceptance incomplete | IMPLEMENTED_UNVERIFIED | GAP-020 | WP-06 |
| REL-001 | Repository reality separated from governed stage credit | this pack + locked master plan | VERIFIED_IMPLEMENTED | — | — |
| REL-002 | Every open gap belongs to one finite work package/exit gate | 23-gap register and Document 8 | VERIFIED_IMPLEMENTED | — | — |
| REL-003 | Release requires green gates, hosted QA, pilot and sign-off | gates exist but current baseline/pilot/runtime not all green | NOT_IMPLEMENTED | GAP-020; GAP-021; GAP-022; GAP-023 | WP-06 / WP-07 |
| REL-004 | Backfill only after approved S08 analysis and S09 controls | D17; S08 artifacts exist without governed approval; S09 pending | PARTIAL | GAP-015; GAP-016 | WP-05 |

## Important interpretation of stage reality

The locked master plan currently grants:

`S01 COMPLETE; S02 PARTIAL; S03 PARTIAL; S04 NOT_STARTED; S05 PARTIAL; S06 NOT_STARTED; S07 PARTIAL; S08 NOT_STARTED; S09 NOT_STARTED; S10 NOT_STARTED`.

Repository reality is richer:

- S02 isolation/reservation hardening artifacts exist.
- S04 property-management GL RPCs/tests exist.
- S06 master-lease lifecycle migration/tests exist.
- S07 reports/accounting/reconciliation surfaces exist in partial form.
- S08 scripts, evidence and tests exist.

None of those facts changes Reviewer-ledger credit. The pack records both truths side-by-side instead of choosing whichever is more convenient.

## Deduplicated Gap Register — 23 gaps

| Gap ID | Severity | Related rules | Evidence / current issue | Required outcome | Work package | Release blocking? |
|---|---|---|---|---|---|---|
| GAP-001 | BLOCKER | SEC-004 | ADR0015 accepts 6 roles; `permissions.ts` has 3 | migrate role/storage/RLS/UI/permission semantics without widening access | WP-01 | Yes |
| GAP-002 | BLOCKER | OPS-007, SEC-008 | Maker-Checker decision exceeds current authoritative enforcement | creator/requester separation for all designated contract/VOID/financial approvals with audited override | WP-01 | Yes |
| GAP-003 | EXTERNAL | DOM-001, SEC-001..003 | repository isolation tests pass; live Auth/RLS/schema drift not proven here | live/deployed cross-company verification tied to release SHA | WP-01 | Yes |
| GAP-004 | HIGH | OPS-005..006, DOM-004..005 | agreement/contract lifecycle exists in pieces | authoritative version/amendment + signed-artifact lifecycle end-to-end | WP-03 | Yes |
| GAP-005 | HIGH | OPS-004 | D12 onboarding policy lacks complete enforced/evidenced workflow | seven-step onboarding, waiver/evidence rules and tests | WP-03 | Yes |
| GAP-006 | BLOCKER | OPS-001, OPS-009, FIN-001, FIN-005 | agent-net/fee kernels exist but user-event wiring is not fully proven | collection→fee recognition→owner position→settlement E2E with tests | WP-02 | Yes |
| GAP-007 | BLOCKER | OPS-009, FIN-006 | fixed-monthly policy approved; full daily accrual scheduler/posting path incomplete | idempotent daily accrual/catch-up/reversal with partial-month tests | WP-02 | Yes |
| GAP-008 | BLOCKER | OPS-012, FIN-008 | 1300 concept exists; full owner recovery/offset lifecycle incomplete | separate Due-from-Owner recovery, lawful offset and post-payout refund behavior | WP-02 | Yes |
| GAP-009 | BLOCKER | OPS-013, DOM-008, FIN-010 | deposit subledger exists; all beneficiary/application/refund/reversal paths not closed | atomic evidence-backed deposit lifecycle and control reconciliation | WP-02 | Yes |
| GAP-010 | HIGH | FIN-012 | tax must be configuration/version driven | company tax profile/codes snapshots, blocking and UI/report integration | WP-02 | Yes |
| GAP-011 | HIGH | OPS-010 | receipt reversal exists but whole void/credit/refund/late-fee/termination matrix is incomplete | controlled lifecycle for all posted adjustments and cash refunds | WP-02 | Yes |
| GAP-012 | BLOCKER | PRD-003, OPS-002, FIN-002, FIN-020 | S06 kernel/tests exist while governed S06 remains NOT_STARTED and E2E reporting is incomplete | independent full master-lease lifecycle, reports/reconciliation and truthful IFRS labeling | WP-04 | Yes |
| GAP-013 | BLOCKER | FIN-019 | control-account reconciliation coverage incomplete | deterministic tenant/owner/deposit/due-from-owner/commission reconciliations | WP-05 | Yes |
| GAP-014 | BLOCKER | FIN-019 | GL core exists; full financial statements/cash-flow completeness not closed | trial balance, P&L, balance sheet, ledger and complete cash flow from GL | WP-05 | Yes |
| GAP-015 | HIGH | OPS-015, REL-004 | S08 scripts/evidence/tests exist but governed S08 is NOT_STARTED/no approved frozen analysis | independent review, frozen baseline and formal analysis approval | WP-05 | Yes |
| GAP-016 | BLOCKER | OPS-015, REL-004 | S09 correction is not authorized/complete | append-only company/period/source-scoped correction batches with before/after approval | WP-05 | Yes |
| GAP-017 | HIGH | OPS-014 | bank import implementation/evidence is not sufficient to close current canonical fail-closed contract | current-SHA preview, counts/limits/3dp/ambiguity/no-partial-success proof | WP-05 | Yes |
| GAP-018 | HIGH | SEC-009 | GL generic browser writes are guarded, but all sensitive financial paths need one final inventory | zero unintended direct browser writes; RPC-only evidence/guard for sensitive mutations | WP-01 | Yes |
| GAP-019 | EXTERNAL | DOM-010 | signed/document workflows cannot prove jurisdiction-specific legal wording | legal review of production templates and evidence requirements | WP-03 | Yes |
| GAP-020 | EXTERNAL | PRD-009, UX-008, REL-003 | local focused tests passed; hosted browser/QA acceptance not established by this doc branch | affected-route autonomous browser QA + mobile/desktop/RTL/print acceptance | WP-06 | Yes |
| GAP-021 | EXTERNAL | SEC-010, REL-003 | repository cannot prove deployed schema/Auth hooks/secrets/backups | release-SHA live environment, Auth, secrets/config, backup/restore evidence | WP-07 | Yes |
| GAP-022 | EXTERNAL | PRD-010, REL-003 | no completed one-office reconciled pilot/sign-off | full pilot cycle, daily reconciliation, accountant approval and rollout decision | WP-07 | Yes |
| GAP-023 | BLOCKER | REL-003 | baseline full-suite/release gates contain pre-existing failures/coverage exceptions | zero release-blocking CI failures and truthful coverage/release gates on candidate SHA | WP-06 | Yes |

## Gap invariants

- Each Gap ID appears once in this register.
- Each Gap ID has exactly one owning Work Package.
- A Rule may reference more than one Gap when its end-to-end contract crosses separate remediation concerns.
- Closing a Gap requires updating its affected Rule statuses and Document 8 exit evidence in the same PR or a directly linked documentation update.

## What is not a gap by itself

The following are not automatically defects merely because governance credit is absent:

- presence of S04/S06/S08 code before the governance ledger grants stage completion;
- legacy route aliases that intentionally redirect/bind to canonical hubs;
- historical technical identifiers such as `rentrix-app` while user branding is MALEK.

They become gaps only when they violate a canonical rule or release gate.
