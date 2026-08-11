# MALEK Canonical Pack — Document 7: Implementation Traceability and Reality

> **Status:** CANONICAL
> **Repository reality baseline:** `main@8ada4e7eb81fbad3d19f5603626f699b5e10d8d5`
> **Audit cut-off:** 2026-08-11
> **Rule count:** 77
> **Gap count:** 23

## How to read this document

This matrix describes repository reality without granting governance credit. `governance/10-stage-master-plan.json`, the Agent checklist and Reviewer ledger remain the authority for governed stage credit. A repository test is not a live-environment test, and a Vercel Ready preview is not journey acceptance.

### Status vocabulary

- `VERIFIED_IMPLEMENTED` — concrete implementation plus meaningful repository verification exists for the stated rule.
- `IMPLEMENTED_UNVERIFIED` — implementation exists but its required verification layer is incomplete or stale.
- `PARTIAL` — only part of the applicable `UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA` chain exists.
- `NOT_IMPLEMENTED` — no conforming implementation of the rule was found.
- `CONFLICT` — implementation or active governance conflicts with the canonical rule.
- `BLOCKED_EXTERNAL` — the remaining proof depends on live configuration, professional approval, secrets, deployment or pilot authority.

`VERIFIED_IMPLEMENTED` does not mean production-deployed or governed-stage complete.

## Verification evidence ledger

| Evidence | SHA / run | Result | What it proves | What it does not prove |
|---|---|---|---|---|
| Original focused brownfield suites | `75832b2f...` lineage | 177/177 passed | navigation/permissions, S03/S04/S06/S08 repository contracts, company isolation and permission-request lifecycle | current hosted environment or Reviewer credit |
| PR #1430 CI / Typecheck, Lint & Build | head `a6aaa864...`, run `31443693198` | SUCCESS | docs links, migration evidence, typecheck, lint, architecture, production build, test typecheck, full application and financial tests | authenticated hosted journeys |
| PR #1430 Release Blocker Gate | run `31443693143` | SUCCESS | code gate and ephemeral migration replay/database/Storage lifecycle gate | authenticated staging job was SKIPPED; no production proof |
| PR #1430 Browser Readiness / E2E Smoke | run `31443693139` | CANCELLED | setup/Chromium succeeded and artifacts uploaded | the complete browser suite did not pass; seeded staging smoke was SKIPPED |
| PR #1430 governance guards | runs `31443693146`, `31443693171` | SUCCESS | execution-plan and canonical-business-rule guards | business correctness beyond guarded files |
| PR #1430 Vercel preview | PR comment/deployment for head | READY | preview deployment availability | functional, financial, mobile, RTL or print acceptance |

All GitHub run identifiers above refer to PR #1430. The merge commit is the audited baseline; the PR head is cited because PR-triggered workflows ran on that SHA.

## Status counts

| Status | Count |
|---|---:|
| VERIFIED_IMPLEMENTED | 36 |
| PARTIAL | 26 |
| IMPLEMENTED_UNVERIFIED | 6 |
| NOT_IMPLEMENTED | 2 |
| CONFLICT | 6 |
| BLOCKED_EXTERNAL | 1 |
| **Total** | **77** |

## 77-rule traceability matrix

Paths are repository-relative. `None` under Runtime means no authorized hosted/live proof was found for the rule at the baseline.

| Rule ID | Canonical rule | Schema/table | RPC/service | UI/route | Permission/RLS | Test evidence | Runtime evidence | Status | Gap/conflict | Work package |
|---|---|---|---|---|---|---|---|---|---|---|
| PRD-001 | Arabic-first, RTL and company-isolated | company-scoped domain tables | `hooks/use-company.tsx`; company helpers | protected shell/routes | company RLS + JWT company claim | `p0-multi-tenant-isolation.test.ts`; `two_company_readiness.sql` | Ephemeral DB gate passed; hosted Auth/RLS not verified | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| PRD-002 | Property-office operating customer | properties, units, parties, contracts, finance tables | feature services | `/properties`, `/people`, `/contracts`, `/financials` | route/action permissions | route and feature suites in PR #1430 CI | Preview Ready; journeys not accepted | VERIFIED_IMPLEMENTED | — | — |
| PRD-003 | Owner-agency plus separate master lease | owner agreements/versions; master-lease tables | `gl_pm_*`; `gl_ml_*` | no complete model-specific UI journey | RPC company/role checks | `s04-property-management-gl.test.ts`; `src/s6/**` | None | PARTIAL | GAP-012 | WP-04 |
| PRD-004 | Oman/OMR 3dp baseline | journal lines `numeric(18,3)`; deposit legacy 2dp | accounting domain/posting engine | company-aware formatters | mixed server/direct-write precision boundaries | Stage-3 tests cover GL, not every legacy subledger | None | CONFLICT | GAP-009 | WP-02 |
| PRD-005 | No silent generic-ERP scope growth | — | — | canonical nav groups plus legacy adjacent routes | route visibility | navigation contract tests | None | IMPLEMENTED_UNVERIFIED | — | — |
| PRD-006 | Core product surfaces exist | core domain tables | feature services | route contract/tree | route guards | `route-contract.test.ts`; `app-nav-items.test.ts` | Preview Ready | VERIFIED_IMPLEMENTED | — | — |
| PRD-007 | Reports separate from Financials | report RPCs/GL | report services | `/reports`; `/accounting` redirect | report/export permissions | IA/navigation tests | Browser suite cancelled | VERIFIED_IMPLEMENTED | — | — |
| PRD-008 | AI Assistant is a separate route and non-authoritative | Edge Function inputs/read-only query sources | `ai-assistant-service.ts` | `/ai-assistant` redirects to Dashboard global overlay | authenticated/read-only guardrails | AI service/edge tests; `p4-settings-admin-cleanup.test.ts` | None | CONFLICT | GAP-023 | WP-06 |
| PRD-009 | Production-ready requires complete evidence chain | cross-domain | cross-domain | critical journeys | RLS/permissions/audit required | CI and ephemeral release gate passed | browser cancelled; staging skipped | PARTIAL | GAP-020, GAP-021 | WP-06 / WP-07 |
| PRD-010 | One-office reconciled pilot before rollout | pilot data cycle | QA/release scripts | real office flows | release controls | `single-office-launch-contract.test.ts` is contract evidence only | no real full-period pilot | NOT_IMPLEMENTED | GAP-022 | WP-07 |
| OPS-001 | Owner-agency is agent-net | agreement versions; GL accounts | S04 property-management GL RPCs | owner/finance surfaces not fully wired | financial RPC guards | S04 GL tests | None | IMPLEMENTED_UNVERIFIED | GAP-006 | WP-02 |
| OPS-002 | MASTER_LEASE is separate principal workflow | master-lease measurements/events | `gl_ml_*`; `src/s6/**` kernels | no complete product journey | RPC company/role checks | `master_lease_gl_lifecycle.sql`; S06 tests | None | PARTIAL | GAP-012 | WP-04 |
| OPS-003 | Explicit collection role | `owner_agreement_versions.collection_role`; contract snapshot | version/snapshot RPCs | no complete terms/version UI | RLS + RPC role/company checks | `s04_owner_agreement_versioning.sql`; snapshot pgTAP | None | VERIFIED_IMPLEMENTED | — | — |
| OPS-004 | Controlled evidence-based property onboarding | core property records only | dashboard data checks | `OnboardingChecklist.tsx` | UI `canManageSetup` only | onboarding component tests | None | PARTIAL | GAP-005 | WP-03 |
| OPS-005 | Material owner-agreement changes create versions | `owner_agreement_versions`; current pointer | `create_owner_agreement_version_atomic` | legacy agreement edit paths; no full version workspace | version RLS/RPC checks | versioning pgTAP | None | PARTIAL | GAP-004 | WP-03 |
| OPS-006 | Contract draft→review→approved→signed→active | contract approval/signature/snapshot columns | submit/approve/reject/activate RPCs | existing form/detail service not proven to invoke full chain | contract RPC role/company checks | maker-checker and snapshot pgTAP | None | PARTIAL | GAP-004 | WP-03 |
| OPS-007 | Maker-Checker for material approvals | contract maker/checker columns; permission requests | contract approval RPCs; permission-review RPC | no complete designated-action workflow | self-approval denial in backend | maker-checker pgTAP; permission workflow tests | None | PARTIAL | GAP-002 | WP-01 |
| OPS-008 | Invoice/AR follows collection role | contract snapshots; GL batches/lines | S04 owner/office creditor RPCs | finance hub not proven wired to kernels | RPC company/role checks | S04 property-management GL tests | None | VERIFIED_IMPLEMENTED | — | — |
| OPS-009 | RATE on collection; FIXED monthly daily | agreement version fee basis | RATE kernel; no complete daily scheduler | no complete accrual UI/ops | server authority required | S04 RATE tests; no complete accrual suite | None | PARTIAL | GAP-006, GAP-007 | WP-02 |
| OPS-010 | Controlled collection/void/credit/refund | payments, receipts, GL reversals | receipt/payment/void RPCs | receipt/payment UI exists | financial permissions/RPCs | receipt void engine and parity tests | None | PARTIAL | GAP-011 | WP-02 |
| OPS-011 | Atomic settlement reservation | settlement payment/expense links | create/approve/pay/cancel settlement RPCs | owner settlements workspace | RLS select; RPC-only writes | reservation concurrency/stale-total tests | Ephemeral lifecycle gate passed | VERIFIED_IMPLEMENTED | — | — |
| OPS-012 | Owner expense → Due from Owner and lawful offset | expenses; 1300; agreement offset flag | S04 owner-expense/settlement surfaces | incomplete recovery/offset journey | financial RPC checks | S04/expense tests | None | PARTIAL | GAP-008 | WP-02 |
| OPS-013 | Deposit liability/application/refund/reversal | tenant deposits/transactions; 2200 | legacy deposit RPC + S04 application kernel | deposit workspace | legacy authenticated writes coexist | deposit/S04 tests | None | PARTIAL | GAP-009 | WP-02 |
| OPS-014 | Bank CSV preview and fail-closed import | import batches/rows | preview/finalize/import RPCs; parser | banking workspace | match/import permissions/RPC guards | `bank_csv_import_fail_closed.sql`; parser tests | hosted import not run | PARTIAL | GAP-017 | WP-05 |
| OPS-015 | Read-only analysis precedes correction | S08 views; no approved S09 write model | `scripts/s08/**` | no governed correction UI | S08 read-only grants | `src/s08/**` tests/evidence | no approved frozen analysis | PARTIAL | GAP-015, GAP-016 | WP-05 |
| DOM-001 | Company scope on owned aggregates | company columns/FKs/RLS | company-aware RPCs | CompanyProvider | current/require company helpers | isolation, enumeration and readiness tests | Ephemeral DB passed; live not verified | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| DOM-002 | Property/unit/land relationships | properties, units, lands | property/unit services/RPCs | property/land routes | RLS and write permissions | entity/route/invariant tests | None | VERIFIED_IMPLEMENTED | — | — |
| DOM-003 | People foundation with owner/tenant meaning | people, owners and party links | party/owner/tenant services | People/owner/tenant dossiers | company RLS | feature/navigation tests | None | VERIFIED_IMPLEMENTED | — | — |
| DOM-004 | Versioned owner agreements | owner agreements/versions | version RPC | no complete management UI; generated types omit versions | RLS + admin/manager RPC | versioning pgTAP | None | PARTIAL | GAP-004 | WP-03 |
| DOM-005 | Contract lifecycle and immutable signed evidence | contracts + maker/checker/snapshot/document data | approval/activation/document services | form/detail/documents shell | contracts/document RLS/RPC | maker-checker, snapshot and document tests | legal/runtime proof absent | PARTIAL | GAP-004 | WP-03 |
| DOM-006 | Invoice/payment/receipt/allocation remain distinct | invoices, payments, receipts, allocations | payment/receipt RPCs | finance collections views | financial RLS/RPC | shared-identity and report parity tests | Ephemeral lifecycle gate passed | VERIFIED_IMPLEMENTED | — | — |
| DOM-007 | Settlement source links prevent double use | settlement link tables/partial unique indexes | settlement lifecycle RPCs | settlement workspace | RPC-only link writes | concurrency/stale-total tests | Ephemeral lifecycle gate passed | VERIFIED_IMPLEMENTED | — | — |
| DOM-008 | Deposit transaction liability subledger | deposit tables/transactions | mixed legacy/S04 paths | deposits view | legacy direct grants conflict with target | deposit/RLS/S04 tests | None | PARTIAL | GAP-009 | WP-02 |
| DOM-009 | Company accounts/periods/batches/lines | Stage-3 GL tables | post/reverse/period RPCs | accounting/report surfaces | protected table/RPC grants | Stage-3 suites | Ephemeral DB gate passed | VERIFIED_IMPLEMENTED | — | — |
| DOM-010 | Audit/documents preserve scoped history | audit log; attachments/vault/contract docs | document/storage services | document/contract/settings surfaces | private bucket + company policies | document/storage tests; release Storage job | ephemeral Storage passed; legal/live proof absent | IMPLEMENTED_UNVERIFIED | GAP-019 | WP-03 |
| FIN-001 | Agent-net owner-agency accounting | 2000/4100 controls; agreement terms | S04 GL kernels | incomplete end-to-end flow | financial RPC boundary | S04 GL tests | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-002 | MASTER_LEASE principal accounting | 1600/2500/6200/6300/4000 + lifecycle tables | S06 GL lifecycle | no full UI/reports | RPC guards | S06 SQL/TypeScript tests | None | PARTIAL | GAP-012 | WP-04 |
| FIN-003 | Owner-creditor collection posts cash/2000 | GL batches/lines | `gl_pm_post_collection_owner_is_creditor` | not proven wired | RPC company/role | S04 GL test | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-004 | Office-creditor invoice and collection use 1201/2000 | snapshots + GL | office-creditor S04 RPCs | not proven wired | RPC company/role | S04 GL test | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-005 | RATE fee recognizes on collection | agreement RATE basis; GL | S04 collection fee split | browser/service trigger not proven | server amount authority | S04 GL test | None | PARTIAL | GAP-006 | WP-02 |
| FIN-006 | FIXED_MONTHLY accrues daily | version field says DAILY_ACCRUAL | no complete scheduler/posting path | none | none complete | no end-to-end accrual proof | None | NOT_IMPLEMENTED | GAP-007 | WP-02 |
| FIN-007 | Owner expense posts to 1300 | expenses; account 1300 | S04 owner-expense posting | incomplete recovery UI | financial RPC | S04/expense tests | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-008 | Lawful offset; payable cannot encode owner debt | offset flag; accounts 2000/1300 | partial settlement calculation/RPCs | no complete offset/recovery flow | approval permissions | partial settlement tests | None | PARTIAL | GAP-008 | WP-02 |
| FIN-009 | Deposit receipt remains 2200 liability | deposit tables + 2200 | legacy `create_deposit_atomic` | deposits view | legacy authenticated table writes | deposit/account tests | None | IMPLEMENTED_UNVERIFIED | GAP-009 | WP-02 |
| FIN-010 | Beneficiary-aware deposit application/reversal | deposit transaction data | `gl_pm_post_deposit_application` | incomplete journey | RPC checks | S04 deposit tests | None | PARTIAL | GAP-009 | WP-02 |
| FIN-011 | Broker commission 6110/2300 then payment | commissions; accounts | approve/pay/reverse commission RPCs | commissions workspace | commission permissions/RPC-only hardening | commission lifecycle pgTAP/tests | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-012 | Versioned configurable tax; no universal rate | legacy tax fields/settings | report/posting tax functions | settings/report surfaces | company settings authority | VAT/report tests | legal/config snapshot E2E absent | PARTIAL | GAP-010 | WP-02 |
| FIN-013 | OMR 3dp server/database authority | GL 3dp; deposit transaction 2dp | GL engine 3dp; legacy deposit path | mixed formatters | mixed boundaries | Stage-3 precision tests expose only GL | None | CONFLICT | GAP-009 | WP-02 |
| FIN-014 | Exactly 18 required accounts | accounts provisioning | chart service/provisioning RPC | accounting settings/reports | account write boundary | chart-of-accounts tests | Ephemeral replay passed | VERIFIED_IMPLEMENTED | — | — |
| FIN-015 | Balanced controlled batches; no browser journals | journal batches/lines | posting engine | journal/report read surfaces | no direct browser writes | GL boundary/balance tests | Ephemeral DB gate passed | VERIFIED_IMPLEMENTED | — | — |
| FIN-016 | Idempotent traceable posting/reversal | event unique key/reversal relation | post/reverse RPCs | business-event callers | RPC-only writes | posting/concurrency/reversal tests | Ephemeral DB gate passed | VERIFIED_IMPLEMENTED | — | — |
| FIN-017 | Monthly periods and late posting | accounting periods | period close/resolve RPCs | accounting periods service | permissions/RPC | periods/reversal/late-post tests | None | VERIFIED_IMPLEMENTED | — | — |
| FIN-018 | Posted history is append-only | GL lifecycle triggers | reversal/adjustment RPCs | no destructive UI authority | table grants/triggers | immutability/reversal tests | Ephemeral DB gate passed | VERIFIED_IMPLEMENTED | — | — |
| FIN-019 | GL statements and subledger reconciliations | GL + operational subledgers; S08 view | report RPCs; S07 kernels | Reports workspace | report grants/permissions | P2 report tests; S07 unit kernels | full reconciled hosted cycle absent | PARTIAL | GAP-013, GAP-014 | WP-05 |
| FIN-020 | Complete MASTER_LEASE accounting/reporting | master-lease lifecycle + GL | S06 schedule/posting/disclosure kernels | no complete product journey | RPC checks | S06 tests | None | PARTIAL | GAP-012 | WP-04 |
| SEC-001 | Active-company context | company membership/claim data | Auth Hook; CompanyProvider | protected shell | JWT claim + company helpers | company hook/provider/isolation tests | hosted hook not verified | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-002 | RLS prevents cross-company access | RLS policies/constraints | company helpers | UI not authority | RLS enabled/hardened | isolation/pgTAP/readiness suites | live drift unverified | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-003 | Sensitive SECURITY DEFINER RPCs revalidate scope | functions and scoped tables | hardened RPC inventory | service callers | safe search path/company guards | enumeration/security-definer tests | live drift unverified | VERIFIED_IMPLEMENTED | GAP-003 | WP-01 |
| SEC-004 | Six product roles | users/role metadata still three-role compatible | `permissions.ts` three roles | labels/guards three roles | existing role helpers | permissions tests | migration not performed | CONFLICT | GAP-001 | WP-01 |
| SEC-005 | Effective-capability authorization | permission requests/grants | effective permission services | route/action gating | RPC/RLS remains authority | permissions/navigation tests | None | VERIFIED_IMPLEMENTED | — | — |
| SEC-006 | Shell write state honors effective grants | permission grants | `getWriteAccessState` | shell/actions | action-specific permissions | permissions tests | None | VERIFIED_IMPLEMENTED | — | — |
| SEC-007 | Revoke then re-request lifecycle | requests/grants/revocation data | permission request/review/revoke RPCs | dialog/settings review | self-review and grant checks | permission workflow integration tests | None | VERIFIED_IMPLEMENTED | — | — |
| SEC-008 | Maker-Checker backend identity separation | contract/checker and permission-review data | contract/review RPCs | incomplete broader UI | self-approval rejection where implemented | contract pgTAP/permission tests | designated full set unverified | PARTIAL | GAP-002 | WP-01 |
| SEC-009 | Sensitive financial writes are RPC/server owned | protected financial tables | financial RPCs + boundary guard | legacy sensitive callers remain to inventory | grants/RLS/RPC | direct-write and GL boundary tests | None | IMPLEMENTED_UNVERIFIED | GAP-018 | WP-01 |
| SEC-010 | Audit/idempotency/storage/config fail closed | repo controls exist | QA/config-dependent services | deployed application | live secrets/hooks/policies | repo/ephemeral tests only | live environment unavailable in audit | BLOCKED_EXTERNAL | GAP-021 | WP-07 |
| UX-001 | Arabic/RTL/responsive | — | formatters/design system | shell/features | accessible permission states | a11y/visual/IA tests | browser suite cancelled | VERIFIED_IMPLEMENTED | GAP-020 | WP-06 |
| UX-002 | Route contract is canonical IA | — | route contract/tree disagree for Documents Vault | all registered routes | route guards | route/nav compatibility tests do not close the hidden legacy mismatch | Preview Ready | CONFLICT | GAP-020 | WP-06 |
| UX-003 | Financial hub and `/finance/*` bindings | financial data | finance services | `/financials` + redirects | financial permissions | financial IA/legacy compatibility tests | None | VERIFIED_IMPLEMENTED | — | — |
| UX-004 | Reports independent | report data/GL | report services | `/reports`; accounting redirect | report/export permissions | route/IA tests | None | VERIFIED_IMPLEMENTED | — | — |
| UX-005 | People root owns party workspaces | party data | party services | `/people`, owners, tenants | route permissions | navigation tests | None | VERIFIED_IMPLEMENTED | — | — |
| UX-006 | Services root plus Service Providers | maintenance/providers | provider atomic services/RPCs | maintenance/provider CRUD routes | provider permissions/RLS | provider isolation/migration/UI tests | None | VERIFIED_IMPLEMENTED | — | — |
| UX-007 | AI Assistant separate route | read-only assistant sources | assistant service/Edge Function | route redirects to Dashboard overlay | read-only guardrails | AI/route tests confirm overlay design | None | CONFLICT | GAP-023 | WP-06 |
| UX-008 | Unified states/format/print/accessibility | cross-domain | shared components/pdf/formatters | broad UI | action guards | UX/a11y/pdf tests | browser/print acceptance not passed | IMPLEMENTED_UNVERIFIED | GAP-020 | WP-06 |
| REL-001 | Separate canonical/code/governance/runtime truth | governance files | documentation process | contributor docs | owner-protected ledgers | governance guards | n/a | VERIFIED_IMPLEMENTED | — | — |
| REL-002 | Every gap has one work package/exit gate | this register | change-control process | n/a | governance | mechanical validation | n/a | VERIFIED_IMPLEMENTED | — | — |
| REL-003 | Release needs green gates, runtime, pilot, sign-off | cross-domain | CI/QA/release workflows | critical flows | all controls | CI/release gate passed; browser cancelled | staging/live/pilot incomplete | PARTIAL | GAP-020, GAP-021, GAP-022 | WP-06 / WP-07 |
| REL-004 | Backfill only after S08 approval and S09 controls | S08 views; no approved S09 | S08 scripts | no correction UI | read-only grants | S08 repository tests | governed approval absent | PARTIAL | GAP-015, GAP-016 | WP-05 |

## Governed stage credit versus repository reality

The locked master plan records:

`S01 COMPLETE; S02 PARTIAL; S03 PARTIAL; S04 NOT_STARTED; S05 PARTIAL; S06 NOT_STARTED; S07 PARTIAL; S08 NOT_STARTED; S09 NOT_STARTED; S10 NOT_STARTED`.

Repository artifacts exist for S02/S04/S06/S07/S08. Contract Maker-Checker, owner-agreement versioning, property-management GL, master-lease kernels and S07 reconciliation kernels are real code. They do not grant Reviewer credit, prove full UI wiring, or authorize S09.

## Deduplicated Gap Register — 23 gaps

| Gap ID | Severity | Related rules | Business impact | Financial/data/security risk | Evidence | Required outcome | Dependencies | Work package | Release blocking? |
|---|---|---|---|---|---|---|---|---|---|
| GAP-001 | BLOCKER | SEC-004 | role assignment cannot express approved job separation | fail-open/fail-closed migration errors may widen or remove access | ADR0015 vs `permissions.ts` three-role catalog | migrate storage/JWT/RLS/UI to six roles with explicit compatibility mapping | owner-approved role mapping; live data inventory | WP-01 | Yes |
| GAP-002 | BLOCKER | OPS-007, SEC-008 | designated approvals are inconsistently separated | self-approval of VOID/settlement/material action | contract Maker-Checker exists; broader authoritative inventory absent | cover every designated action, audited sole-admin override and UI workflow | GAP-001 capability model; action inventory | WP-01 | Yes |
| GAP-003 | EXTERNAL | PRD-001, DOM-001, SEC-001..003 | multi-company operation cannot launch without exact tenant isolation | cross-company disclosure or mutation | repository/ephemeral tests pass; hosted hook/RLS/schema drift unknown | release-SHA live negative tests and Auth Hook/claim/policy evidence | authorized QA/live credentials; deployed SHA | WP-01 | Yes |
| GAP-004 | HIGH | OPS-005..006, DOM-004..005 | agreements/contracts can bypass the canonical lifecycle in current UI paths | retroactive terms, wrong snapshot, unsigned activation | DB versioning/Maker-Checker exists; generated types/UI/service wiring incomplete | one end-to-end version/amendment/approval/signature/activation chain | GAP-001/002; legal template content | WP-03 | Yes |
| GAP-005 | HIGH | OPS-004 | property setup is a dismissible checklist, not controlled onboarding | missing identity/safety evidence and unaudited waiver | `OnboardingChecklist.tsx`, `useOnboarding.ts` localStorage; no seven-step backend model | enforce seven-step templates, non-waivable gates and audited admin waivers | document platform; permissions | WP-03 | Yes |
| GAP-006 | BLOCKER | OPS-001, OPS-009, FIN-005 | office/owner positions may not reflect actual collection fee | misstated revenue, owner payable and VAT | S04 RATE kernel/tests; no proven browser/service trigger | collection→fee→owner position→settlement E2E and reconciliation | canonical event wiring; tax config | WP-02 | Yes |
| GAP-007 | BLOCKER | OPS-009, FIN-006 | fixed-fee agreements cannot accrue correctly | missing/mistimed revenue and owner receivable | version field exists; no complete daily scheduler/posting tests | idempotent daily accrual, catch-up, reversal and partial-month 3dp cases | periods; scheduler authority; tax config | WP-02 | Yes |
| GAP-008 | BLOCKER | OPS-012, FIN-008 | office cannot recover owner-paid costs safely | negative owner payable, lost receivable or unlawful offset | 1300/kernel/offset field exist; full workflow absent | Due-from-Owner subledger, recovery, lawful ordering and post-payout refund behavior | agreement rights; settlements; Maker-Checker | WP-02 | Yes |
| GAP-009 | BLOCKER | PRD-004, OPS-013, DOM-008, FIN-009..010, FIN-013 | deposit balances and applications are not one authoritative lifecycle | 2dp/3dp drift, direct writes, wrong beneficiary, duplicate/refund errors | legacy deposit migration grants/direct `journal_entries`; later S04 kernels | 3dp RPC-only immutable deposit lifecycle reconciled to 2200 | contract snapshots; evidence; GL engine | WP-02 | Yes |
| GAP-010 | HIGH | FIN-012 | taxable events cannot be reliably versioned per company | statutory misstatement or silent default rate | locked D08; legacy VAT/settings/report paths | versioned tax profiles/codes and per-line snapshots; block incomplete config | professional tax decision; GL event wiring | WP-02 | Yes |
| GAP-011 | HIGH | OPS-010 | posted adjustments are fragmented across paths | destructive/missing reversal, cash/report mismatch | receipt VOID exists; full credit/refund/late-fee/termination matrix absent | controlled event matrix with audit and GL/subledger parity | GAP-002; tax/period rules | WP-02 | Yes |
| GAP-012 | BLOCKER | PRD-003, OPS-002, FIN-002, FIN-020 | master-lease cannot be operated or reported as a finished module | IFRS overclaim and misstated lease balances | S06 DB/TypeScript kernels; no complete UI/service/reports | independent head-lease/sublease lifecycle and reconciliation with truthful labeling | S03/05 controls; professional accounting review | WP-04 | Yes |
| GAP-013 | BLOCKER | FIN-019 | control accounts cannot be proven against detailed schedules | unexplained tenant/owner/deposit/commission differences | generic S07 reconciliation kernel; no full data adapters/control suite | deterministic 1201/2000/1300/2200/2300 reconciliations | close all source lifecycle gaps | WP-05 | Yes |
| GAP-014 | BLOCKER | FIN-019 | financial statements cannot be accepted as complete | incomplete cash flow or mixed legacy/GL bases | report RPCs and GL exist across generations | trial balance/P&L/balance sheet/GL/cash flow from posted GL with report-basis tests | GAP-013; periods; event wiring | WP-05 | Yes |
| GAP-015 | HIGH | OPS-015, REL-004 | historical state cannot be frozen for decision | correcting the wrong company/period/source | S08 code/evidence exists; governed S08 remains NOT_STARTED | independent review, frozen baseline and formal approval | live data access; Reviewer authority | WP-05 | Yes |
| GAP-016 | BLOCKER | OPS-015, REL-004 | historical errors cannot be corrected safely | destructive or untraceable backfill | no governed S09 implementation/authorization | append-only scoped correction batches with before/after and reversal | GAP-015 approved first | WP-05 | Yes |
| GAP-017 | HIGH | OPS-014 | bank imports cannot be accepted operationally | partial/duplicate/ambiguous cash data | fail-closed SQL/tests exist; no hosted current-SHA journey | prove preview, counts/limits/3dp/ambiguity/full rejection and matching | hosted QA bank file/data | WP-05 | Yes |
| GAP-018 | HIGH | SEC-009 | sensitive mutation surface remains uncertain | browser bypass of RPC/audit/GL controls | boundary guards exist; legacy deposit and distributed SDK writes remain | exhaustive sensitive-write inventory with zero unintended direct writes | domain owners; GAP-009/011 | WP-01 | Yes |
| GAP-019 | EXTERNAL | DOM-010 | signed documents may be operationally present but legally unusable | wrong wording/evidence/retention | private document platform exists; jurisdiction approval absent | approved templates, evidence and retention rules | Omani legal/accounting review | WP-03 | Yes |
| GAP-020 | HIGH / EXTERNAL | PRD-009, UX-001..002, UX-008, REL-003 | operators may face broken or competing critical flows despite green unit/CI gates | hidden legacy authority, wrong print totals, inaccessible/overflow states | Documents Vault route contract/tree mismatch; Browser Readiness cancelled; staging smoke skipped; preview Ready only | remove/redirect the competing Documents Vault surface and complete hosted mobile/desktop/RTL/print critical-journey acceptance | stable preview/QA data and credentials | WP-06 | Yes |
| GAP-021 | EXTERNAL | PRD-009, SEC-010, REL-003 | repository truth may differ from deployment | schema/Auth/RLS/secret/backup failure | config/migrations/QA scripts exist; hosted state not audited | exact-SHA live config, Auth Hook, functions, secrets, RLS and restore evidence | authorized environment access | WP-07 | Yes |
| GAP-022 | EXTERNAL | PRD-010, REL-003 | product has no proven real operating cycle | unreconciled money/data at launch | no completed full-period one-office pilot/sign-off | pilot daily ops plus full-period GL/subledger reconciliation and decision | all prior release blockers | WP-07 | Yes |
| GAP-023 | HIGH | PRD-008, UX-007 | approved AI IA and actual UX disagree | user/context confusion; future agents may implement against wrong contract | route contract marks legacy deep-link; route redirects to Dashboard overlay | either restore true separate route or obtain canonical decision changing PRD-008/UX-007; keep assistant read-only | product-owner IA decision; hosted UX proof | WP-06 | Yes |

## Gap invariants

- Every Gap ID appears once and has one owning Work Package.
- A Rule may reference multiple gaps when its end-to-end contract crosses independently closable risks.
- Closing a gap requires implementation evidence, the smallest meaningful verification, and same-PR updates to affected rule rows and Document 8.
- A successful CI run closes only its actual CI assertion. It does not close Browser, hosted Auth/RLS, legal or pilot gates.

## What is not a gap by itself

- S04/S06/S08 code existing without governed completion credit.
- Intentional compatibility redirects that preserve one canonical IA.
- Historical technical identifiers such as `rentrix-app` while user branding is MALEK.
- Vercel Preview availability without journey acceptance.
