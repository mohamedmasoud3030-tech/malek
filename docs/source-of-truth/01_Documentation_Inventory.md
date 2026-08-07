# 01 — Documentation Inventory

> **Branch:** `docs/source-of-truth-consolidation` · **Compiled:** 2026-08-07 (Asia/Muscat)
> **Method:** every `.md` documentation file in the repository (plus governance JSON registers, one `.txt` evidence file) was read and analyzed. `rentrix-app/public/robots.txt` is a crawler config file, not documentation, and is the only matched file intentionally excluded.
> **Total inventoried:** 166 documents.

## Categories

| Category | Meaning |
|---|---|
| **ACTIVE** | Still valid as-is; safe to rely on today. |
| **PARTIALLY VALID** | Contains useful information mixed with obsolete content. |
| **DUPLICATED** | Already covered elsewhere; adds no unique knowledge. |
| **OBSOLETE** | No longer reflects the current product/direction. |
| **DECISION REQUIRED** | Cannot be auto-merged; business direction unclear. |

## Reality flags

| Flag | Meaning |
|---|---|
| ✅ current | Matches the current product direction and `main`. |
| ⚠️ needs update | Sound core, but facts/references drifted. |
| ❌ outdated | Content no longer true; kept only as history. |

---

## A. Root documents

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `README.md` | Repo entry point | Product intro, commands, doc pointers, payment-backed receipts rule | High, but brand line stale | **PARTIALLY VALID** | ⚠️ (says visible name is "MALIK"; code+ADR 0011 say MALEK) | AGENTS.md brand note | ADR 0011-brand, `docs/brand/MALEK_ASSET_CONTRACT.md`, live `index.html`/`manifest.json` | `02_Product_Vision`, `08_Brand_Design` | YES (brand-spelling reconciliation C-01) |
| 2 | `AGENTS.md` | Agent/contributor operating rules | Read-skills-first, context map routing, verify-code-wins, scope discipline | High | **ACTIVE** | ⚠️ (brand note says MALIK) | docs/README intro | Same brand conflict | Pointers consolidated in `06_Architecture` §Contributor path | NO |
| 3 | `AUDIT_INVENTORY.md` | Brand audit inventory (2026-07-28) | MALIK-era brand surface map, preserved `rentrix` identifiers, rejected changes | Historical | **OBSOLETE** | ❌ (MALEK rebrand ADR 0011 followed on 2026-08-04) | FINAL_DELIVERY.md | ADR 0011, asset contract (`/malek-mark.svg` vs `malik-mark.svg`) | `08_Brand_Design` §Naming chronology | NO (deletion proposal D-2) |
| 4 | `FINAL_DELIVERY.md` | Brand audit final delivery | Same audit outcome + preserved contracts | Historical | **OBSOLETE** | ❌ | AUDIT_INVENTORY.md | ADR 0011 | `08_Brand_Design` | NO (D-2) |
| 5 | `MIGRATION_AUDIT.md` | Multi-tenant table audit (2026-07-22) | 63 tables tiered for `company_id`; helper-function impact list | Historical; multi-tenant shipped (P0 #1276) | **OBSOLETE** | ❌ | docs/MULTI_TENANT_ARCHITECTURE.md (same content, expanded) | — | `06_Architecture` §Multi-tenancy | NO (D-3) |
| 6 | `PENDING_MIGRATION_BLOCKER_FIXES_ASSESSMENT_20260712.md` | Migration blocker fixes (2026-07-12) | text-vs-uuid fixes for 3 pending migrations; verification SQL | Historical; fixes long merged | **OBSOLETE** | ❌ | — | — | Lessons → `06_Architecture` §ID-type rule | NO (D-3) |
| 7 | `PHASE_1_TEST_PLAN.md` | Phase-1 financial-safety test plan (2026-07-13) | 38 manual tests (CASCADE fixes, permissions, expense RPC) | Historical; executed | **OBSOLETE** | ❌ | — | — | — | NO (D-3) |

## B. `docs/` top level

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 | `docs/README.md` | Maintained doc index | What is authoritative, archive policy exception | High | **ACTIVE** | ⚠️ (title "MALEK index" vs root README "MALIK"; index omits newer folders: accounting, execution, s08, security, business) | — | root README | Updated pointers live in `docs/source-of-truth/README.md` | YES (C-01 by reference) |
| 9 | `docs/APP_STATUS.md` | Single source of app status | Verified status as of 2026-07-27: features, data volume, quality gates, open issues | High but time-boxed | **PARTIALLY VALID** | ⚠️ (predates S02/S06/S07/Wave-3/4A merges and 2026-08-07 drift audit; 164-migration claim now 189) | NEXT.md (status overlap) | `11_Current_Status` | `10_Roadmap`, `11_Current_Status` | YES (whether to refresh or supersede by `11_Current_Status`) |
| 10 | `docs/PRODUCT.md` | Product scope | Single-office system of record; users; areas; payments-based collections decision | High | **PARTIALLY VALID** | ⚠️ (points to archived CURRENT_STATE; commission note refined by 0011-D03) | — | — | `02_Product_Vision` | NO |
| 11 | `docs/DOMAIN.md` | Domain entity model | Entities, statuses, roles, known modeling gaps | High | **PARTIALLY VALID** | ⚠️ (claims deposits not modeled — they are now; mixed ID-type warnings remain valid) | agent-context/DOMAIN.md | APP_STATUS/ARCHITECTURE (deposits) | `05_Legal_Workflows` + `06_Architecture` entity map | NO |
| 12 | `docs/ARCHITECTURE.md` | App architecture | Repo layout, frontend layers, Guard v2, finance routes, 2026-08 consolidation, ownership model, zero-leak patterns | High | **PARTIALLY VALID** | ⚠️ (brand section says "text-only wordmark, no logo file" — contradicted by `/malek-mark.svg`; legacy-icons note stale) | — | ADR 0011-brand assets | `06_Architecture` | NO |
| 13 | `docs/DATABASE_ARCHITECTURE.md` | DB structure | Table groups, contract/invoice/payment/receipt/settlement lifecycles, journal flow, reporting views/RPCs | High | **ACTIVE** | ⚠️ (pre-Stage-3 GL model; says journal via `journal_entries` — now a view over batches/lines) | — | ADR 0010 (canonical GL) | `06_Architecture` §Data layer + `04_Accounting` | NO |
| 14 | `docs/MULTI_TENANT_ARCHITECTURE.md` | Multi-tenant design | companies/company_members, JWT company_id, RLS pattern, known follow-ups | Medium | **PARTIALLY VALID** | ⚠️ (written pre-P0; "known issues" (company selector unwired, INSERT injection audit) partially resolved; RESTRICTIVE policy model added later in P0) | MIGRATION_AUDIT.md | — | `06_Architecture` §Multi-tenancy | NO |
| 15 | `docs/ENGINEERING_GOVERNANCE.md` | Mandatory engineering policy | Drift prevention, migration rules, quality gates, protected files, agent protocols | High | **PARTIALLY VALID** | ⚠️ (repo name `rentrixxx` now `malik`; types path `database.types.ts` now `types/database.ts`; points to archived `docs/CURRENT_STATE.md`; last updated 2026-07-12, predates constitution/10-stage governance) | GOVERNANCE.md (rule split intentional) | — | `06_Architecture` §Engineering policy | YES (confirm policy refresh scope D-5) |
| 16 | `docs/GOVERNANCE.md` | The one production-mutation rule | No mutation without explicit owner sign-off; CI guarded; **do not delete** | Critical | **ACTIVE** | ✅ | — | — | Referenced from `06_Architecture` + `11_Current_Status` (kept standalone by design) | NO (protected file) |
| 17 | `docs/GOVERNANCE_LOG.md` | Append-only consent trail | 9 entries, all 2026-07-06…07-18 | Critical but stale | **ACTIVE** | ⚠️ (no entries for post-07-18 live mutations incl. `20260730090500` or the 26 out-of-band 2026-08-06 migrations) | — | Own rule ("one line per mutation") | Gap escalated → `12_Open_Decisions` OD-14 | YES (backfill policy) |
| 18 | `docs/NEXT.md` | Active execution queue | Stage-3 summary, P0/P1/3A-1B/1C records, single-office pilot plan, standing fixes | High but drifted | **PARTIALLY VALID** | ⚠️ (predates PRs #1350–#1369; migration count 164→189; "P2 القادم" items partly done) | APP_STATUS.md | — | `10_Roadmap` | YES (refresh cadence D-5) |
| 19 | `docs/FEATURE_GAP_REGISTER.md` | Gap register FGR-001…014 | Gap statuses reconciled 2026-07-27 | High | **PARTIALLY VALID** | ⚠️ (FGR-002/003/006/009/010/014 progress landed since via #1350/#1361/#1363; statuses stale) | — | — | Open gaps → `09_Feature_Catalog` (per-feature status) + `10_Roadmap` | NO |
| 20 | `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` | Phase-5 decision gates | 7 gates marked "decided; implementation required" | Resolved by ADRs 0001/0011 | **OBSOLETE** | ❌ | decisions/0001, accounting/ACCOUNTING_DECISION_GATES_AR | — | `03_Business_Rules` (content fully merged) | NO (deletion proposal) |
| 21 | `docs/TESTING.md` | Test commands & expectations | Full command reference, run-when matrix, brand note MALIK | High | **ACTIVE** | ⚠️ (brand note) | — | — | Commands summarized in `11_Current_Status` §Quality gates | NO |
| 22 | `docs/SECURITY_MODEL.md` | Security model | Helpers, RLS model, definer usage, search_path pinning, boundaries | High | **ACTIVE** | ✅ (structural; P0 restrictive policies & JWT-only derivation should be added) | security/FINANCIAL_WRITE_TRUST_MODEL_AR | — | `06_Architecture` §Security | NO |
| 23 | `docs/RPC_REFERENCE.md` | RPC reference | 7 core RPCs with params/protections | Medium | **PARTIALLY VALID** | ⚠️ (pre-jsonb payloads; covers 7 of ~90 functions; instructs verify-live) | evidence/p0/rpc-security-matrix, execution/S02 inventory | — | `06_Architecture` §RPC catalog pointer | NO |
| 24 | `docs/SEEDED_STAGING_READINESS_RUNBOOK.md` | Staging runbook | Seeded env, ordered verification, stop conditions | High | **ACTIVE** | ✅ | ADR 0002 (governs it) | — | `11_Current_Status` §Readiness evidence | NO |
| 25 | `docs/SINGLE_OFFICE_LAUNCH.md` | Pilot launch contract | Scope, automated gate, GO conditions (2 unchecked) | High but dated | **PARTIALLY VALID** | ⚠️ (verified 2026-07-27 baseline `4c354f34`; many releases since) | RELEASE_READINESS.md | — | `10_Roadmap` §Pilot | NO |
| 26 | `docs/RELEASE_READINESS.md` | Release decision record | GO for pilot, HOLD for real accounts, verified baseline | Medium; point-in-time | **PARTIALLY VALID** | ⚠️ (baseline from 2026-07-27) | SINGLE_OFFICE_LAUNCH.md, APP_STATUS.md | — | `11_Current_Status` | NO (deletion/archive proposal) |
| 27 | `docs/RELEASE_EVIDENCE_LEDGER.md` | Evidence ledger for 99.9% claim | Evidence states + mandatory rows for exact commit | High (template) | **ACTIVE** | ⚠️ (status column frozen at 2026-07-27 runs) | — | — | Retained; referenced by `11_Current_Status` | NO |
| 28 | `docs/PHASE_0_SETTINGS_AUTH_AUDIT.md` | Phase-0 audit (2026-07-05) | Settings services + auth guards audit; live verification checklist | Historical | **OBSOLETE** | ❌ | — | — | Lessons → `06_Architecture` | NO (deletion proposal) |
| 29 | `docs/PHASE_MINUS_1_SHARED_COMPONENTS_AUDIT.md` | Phase −1 component audit | EntityCard extension-point audit, direction proposal | Historical | **OBSOLETE** | ❌ | — | — | — | NO (deletion proposal) |
| 30 | `docs/PRODUCTION_HARDENING_AUDIT_20260711.md` | Hardening pass record | Security/RLS/index/journal-protection fixes 2026-07-11 | Historical record | **OBSOLETE** | ❌ | — | — | Lessons → `06_Architecture` §Hardening rules | NO (deletion proposal) |

## C. `docs/decisions/` (ADRs)

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | `docs/decisions/README.md` | ADR index + format rules | When/how to write ADRs, supersede rule | High | **ACTIVE** | ⚠️ ("next record takes 0013-" — 0013/0014 already exist) | — | — | Format rules → `06_Architecture` §Docs policy | NO |
| 32 | `0001-product-accounting-policies.md` | Core product accounting policies | Office fees, master lease, daily/open-ended, utilities, maintenance, deposits, dual cash/accrual reporting | Critical | **ACTIVE** | ⚠️ (largely absorbed into constitution; FIXED-MONTHLY basis changed by 0011-D02) | 0011 D01–D15 | 0004 → 0011-D02 (fee basis) | `03_Business_Rules`, `04_Accounting` | NO (content merged) |
| 33 | `0002-staging-live-verification-and-release-evidence.md` | Staging/evidence governance | No mutating CI on prod; seeded staging; 7-day freshness; sign-off | High | **ACTIVE** | ✅ | — | — | `11_Current_Status` §Evidence rules | NO |
| 34 | `0003-company-scoped-account-resolution.md` | 3A account-resolution doctrine | require/ensure_company_account, `coa:<company>:<no>` IDs, phased conversion | High | **ACTIVE** | ⚠️ (3A-2 composite uniqueness now done in Stage 3; "temporary limitations" resolved) | 0010 | — | `04_Accounting` | NO |
| 35 | `0003-financial-security-ux-reporting-and-reconciliation-scope.md` | Release scope: golden path, roles, RTL, reports, bank rec | Six business roles; report/export requirements; bank-rec launch scope | High | **ACTIVE** | ⚠️ (roles beyond ADMIN/MANAGER/USER not implemented; import scope later hardened to fail-closed CSV per D16 + S02) | — | permissions.ts (3 roles) | `03_Business_Rules` §Roles (conflict C-05) | YES (role expansion C-05) |
| 36 | `0004-proration-and-billing-basis.md` | FULL_MONTH default; DAILY_PRORATED extension | Month-count default preserved 2026-07-24 | Superseded in substance | **PARTIALLY VALID** | ❌ (0011-D02 + constitution: RATE on collection, FIXED_MONTHLY daily accrual, "no FULL_MONTH default after this decision") | — | 0011-D02, ACCOUNTING_DECISION_GATES_AR §C4 | `04_Accounting` §Fee accrual (conflict C-02) | YES (formal supersession note needed on 0004) |
| 37 | `0005-account-resolution-payment-receipt-void.md` | 3A-1B doctrine | Canonical resolution, no client account ids, VOID clone-original rule, namespaced idempotency | High | **ACTIVE** | ⚠️ (VOID "clones original account ids" conflicts with S03 audit finding of client-supplied `p_reverse_entries` in live RPC — C-08) | — | S03_T01_GL_GAP_AUDIT | `04_Accounting` | YES (C-08 void-reversal implementation) |
| 38 | `0006-owner-settlement-account-resolution-and-request-binding.md` | 3A-1C doctrine | Company-canonical payouts; immutable request binding | High | **ACTIVE** | ✅ | — | — | `04_Accounting` | NO |
| 39 | `0008-financial-routes-ux-clarity.md` | `/financials` vs `/reports` separation | Quick summary vs detailed reports; shared i18n keys | High | **ACTIVE** | ⚠️ (finance hubs IA added later (#1339, ADR 0014): `/finance/collections` etc. — complements, doesn't revoke) | — | — | `07_UX_Bible` §Finance IA | NO |
| 40 | `0009-malek-canonical-accounting-model.md` | Early accounting model | property_management agent/net; master-lease principal; GL/subledger split | Historical (self-superseded) | **OBSOLETE** (normatively) | ❌ (declares itself superseded by constitution) | constitution + 0011 | — | `04_Accounting` (historical pointer only) | NO |
| 41 | `0010-stage3-general-ledger-core.md` | Stage-3 GL canonical model | journal_batches/lines/periods/engine; compat view; 18 accounts per company | Critical | **ACTIVE** | ⚠️ (implemented in migrations; S03 gap audit shows engine not wired into business paths) | — | Live behavior (S03 audit) | `04_Accounting` §Canonical GL | NO |
| 42 | `0011-final-business-accounting-and-operating-policies.md` | FINAL policies D01–D18 | Locked product decisions; supersedes all BLOCKED/PROVISIONAL states | Critical — LOCKED | **ACTIVE** | ✅ (implementation incomplete by design) | Machine twin: `governance/final-decision-register.json` | 0004 (fee basis), contract-rights matrix (BLOCKED states) | `03_Business_Rules`, `04_Accounting`, `05_Legal_Workflows` | NO (owner locked) |
| 43 | `0011-malek-visible-brand-identity.md` | Visible brand = MALEK | Assets `/malek-mark/lockup/maskable.svg`; compatibility boundary | Critical | **ACTIVE** | ✅ (code matches) | brand/MALEK_ASSET_CONTRACT.md | README/AGENTS/TESTING "MALIK" notes (C-01) | `08_Brand_Design` | NO (decided; docs must catch up) |
| 44 | `0012-malek-design-system-refresh-roadmap.md` | Design-system roadmap | Accessible Minimalism + Bento + Enterprise-SaaS-mobile + Executive Dashboard + Financial Dashboard rules; scoped V2 proof; 7 phases | Critical | **ACTIVE** | ✅ (Phase 2 done; Waves 1–3 beyond scope via 0013/0014/#1368) | ui-ux/MALEK_VISUAL_CONTRACT_V2 | — | `08_Brand_Design` | NO |
| 45 | `0013-malek-visual-contract-v2-wave-1-rollout.md` | Wave-1 rollout contract | Semantic tokens mandatory; no raw palettes; PR #1357 scope lock | High | **ACTIVE** | ✅ (merged) | — | — | `08_Brand_Design` | NO |
| 46 | `0014-malek-visual-contract-v2-wave-2-finance-reporting.md` | Wave-2 finance/reporting contract | Finance hubs inventory, logic-protection rules, states contract, status semantics | High | **ACTIVE** | ✅ (merged incl. corrections) | — | — | `07_UX_Bible`, `08_Brand_Design` | NO |

## D. `docs/business/`, `governance/`, `docs/accounting/`, `docs/database/`, `docs/security/`, `docs/brand/`, `docs/adr/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 47 | `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` | LOCKED constitution v2.0.0 | Operating models, agreement/contract rules, GL/periods, import, correction, change control | Critical — LOCKED | **ACTIVE** | ✅ | governance/canonical-business-rules.json (machine twin) | — | `03_Business_Rules` (references; LOCKED source stays standalone) | NO |
| 48 | `governance/canonical-business-rules.json` (+ `.sha256`) | Machine constitution | Same rules, machine-readable; guard-enforced | Critical — LOCKED | **ACTIVE** | ✅ | #47 | — | `03_Business_Rules` pointer | NO |
| 49 | `governance/final-decision-register.json` (+ `.sha256`) | D01–D18 register | blocked=0, provisional=0 | Critical — LOCKED | **ACTIVE** | ✅ | 0011-final | — | `03_Business_Rules` pointer | NO |
| 50 | `governance/10-stage-master-plan.json` (+ `.sha256`) | LOCKED execution plan | S01–S10, statuses, rules | Critical | **ACTIVE** | ⚠️ (statuses: S02/S03/S05/S06/S07/S08 work merged since lock; ledger not yet marked) | execution/10_STAGE_* | — | `10_Roadmap` §10-stage plan | YES (status-reconciliation D-4) |
| 51 | `governance/BUSINESS_RULES_CHANGELOG.md` | Constitution changelog | v1.0.0/v2.0.0 changes, SHAs, S01 completion | High | **ACTIVE** | ✅ | — | — | — | NO |
| 52 | `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md` | Decision gates C1–C11 FINAL | Maps gates→D01–D18, all FINAL | Medium | **DUPLICATED** | ✅ but redundant | 0011-final + register (content identical in substance) | — | `04_Accounting` (merged; candidate for diary-only retention) | YES (D-6 fold-or-keep) |
| 53 | `docs/accounting/CANONICAL_ACCOUNTING_EVENT_SPEC_AR.md` | 30-event accounting spec | Event-by-event postings + required fields + general rules | High | **PARTIALLY VALID** | ⚠️ (pre-0011 residues: FULL_MONTH per 0004 at §4; several BLOCKED statuses now FINAL; otherwise the core spec for S04–S05) | — | 0004 vs 0011 (within itself) | `04_Accounting` §Event spec | NO |
| 54 | `docs/accounting/ACCOUNTING_ACCEPTANCE_SCENARIOS_AR.md` | Numeric acceptance scenarios | 1,000 OMR cases incl. partial payments, mid-month fee, owner-expense offsets | High | **PARTIALLY VALID** | ⚠️ (Scenario 3 keeps FULL_MONTH narrative) | — | 0011-D02 | `04_Accounting` §Acceptance scenarios | NO |
| 55 | `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md` | Future field/table/function impact map | Fields (`principal_agent_role`, `collection_role`…), expected tables/functions/reports | High for S04–S06 | **PARTIALLY VALID** | ⚠️ (written 2026-08-04 pre-0011; some items now decided; some tables landed in Stage 3/S06) | — | — | `04_Accounting` §Schema impact | NO |
| 56 | `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md` | Legal/contract rights matrix | Evidence-based question table per model; missing contract templates list | Medium | **PARTIALLY VALID** | ⚠️ (BLOCKED/PROVISIONAL statuses superseded by 0011 as product decisions; the *legal-evidence* list remains open as business action) | — | 0011 (supersession rule) | `05_Legal_Workflows` §Legal evidence (OD-03) | YES (legal evidence gathering) |
| 57 | `docs/accounting/SETTLEMENT_ITEM_RESERVATION_DESIGN_AR.md` | FA-003 reservation design | payment/expense link tables, atomic reservation, cancel/pay policy, backfill | High (implemented) | **ACTIVE** | ✅ (merged; live-verified per S02 drift audit) | — | — | `04_Accounting` §Settlements | NO |
| 58 | `docs/accounting/S03_T01_GL_GAP_AUDIT.md` | S03 gap matrix before SQL | Engine-not-wired finding; late_posting/posting_date absent; reports not GL-based | Critical (current) | **ACTIVE** | ✅ (2026-08-06 audit; basis of S03 work) | — | 0010 (documents gap vs it) | `04_Accounting` §Reality gaps + `12_Open_Decisions` | NO |
| 59 | `docs/database/MIGRATION_AND_ROLLBACK_POLICY_AR.md` | Migration/rollback policy | Forward-only immutable chain; manual rollbacks; corrective-migration pattern | High | **ACTIVE** | ✅ | ENGINEERING_GOVERNANCE §8 | — | `06_Architecture` §Migrations | NO |
| 60 | `docs/security/FINANCIAL_WRITE_TRUST_MODEL_AR.md` | Financial write trust model | Browser untrusted; RPC-only writes; trust layers | High | **ACTIVE** | ✅ | adr/0009-write-inventory | — | `06_Architecture` §Security | NO |
| 61 | `docs/adr/0009-write-inventory.md` | Frontend write inventory ADR | Financial = RPC-only; non-financial = allowlist; raw queue list | High | **ACTIVE** | ⚠️ (queue partially hardened since via #1361) | security/FINANCIAL_WRITE_TRUST_MODEL_AR | — | `06_Architecture` §Write boundaries | NO |
| 62 | `docs/brand/MALEK_ASSET_CONTRACT.md` | Locked brand assets | Surface→asset map; legacy icons forbidden | High | **ACTIVE** | ✅ | 0011-brand | AUDIT_INVENTORY (malik-mark) | `08_Brand_Design` | NO |

## E. `docs/execution/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 63 | `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md` | Agent execution ledger (98 tasks) | S01 ✔; S02–S10 unchecked boxes | Critical (working ledger) | **ACTIVE** | ⚠️ (boxes unmarked despite merged S02/S06/S07/S08 PRs — agent protocol requires evidence-linked marking) | governance/10-stage-master-plan.json | — | `10_Roadmap` | YES (marking workflow D-4) |
| 64 | `docs/execution/10_STAGE_REVIEW_LEDGER_AR.md` | Reviewer ledger | S01 reviewed; everything else blank | Critical | **ACTIVE** | ✅ (correct by design — reviewer-only) | — | — | `10_Roadmap` | NO |
| 65 | `docs/execution/10_STAGE_STATUS_AR.md` | Stage status snapshot | Status table + discovered gaps + agent prohibitions | High | **PARTIALLY VALID** | ⚠️ (says S03 NOT_STARTED & S02 "next", but S02/S06/S07/S08 merges exist; live-drift audit disputes stage docs' substance) | master-plan JSON | S02_LIVE_DRIFT_AUDIT_20260807 | `10_Roadmap`, `11_Current_Status` | YES (D-4) |
| 66 | `docs/execution/S02_LIVE_DRIFT_AUDIT_20260807.md` | **Live-vs-repo drift audit (today)** | 26 live-only migrations; 14 repo-only files; S02 substance live; pay/reverse commission gap fixed | Critical (current) | **ACTIVE** | ✅ | — | 10_STAGE_STATUS_AR (contradicts its stage claims), supabase/migrations/README (stale counts) | `11_Current_Status` §Drift | YES (deprecation path for 14 stale files) |
| 67 | `docs/execution/S02_SECURITY_DEFINER_INVENTORY.md` | Static definer inventory | 25 functions with security props | Medium | **PARTIALLY VALID** | ⚠️ (static; drift audit: 9 listed functions don't exist live; pay/reverse commission absent live at audit time) | — | S02_LIVE_DRIFT_AUDIT | `06_Architecture` §RPC security | NO |
| 68 | `docs/execution/S02_T06_FINANCIAL_DIRECT_WRITE_HARDENING.md` | S02-T06 hardening record | Payments/expenses RPC-only; ACL/PL/RFC contracts | High (merged #1361) | **ACTIVE** | ✅ | audits/FINANCIAL_DIRECT_WRITE_SURFACE_AUDIT_AR (commissions counterpart) | — | `06_Architecture` §Write boundaries | NO |

## F. `docs/s08/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 69 | `docs/s08/FINAL_REPORT.md` | **S08 status correction** | "S08 is NOT complete; PR #1366 not ready for independent review" — fixture evidence + WHERE FALSE stubs | Critical honesty note | **ACTIVE** | ✅ (but merged PR `8e4908a7` exists — see OD-11) | docs/s08/operational-runbook | evidence/s08/FINAL_REPORT.md (claims evidence package), git merge | `11_Current_Status` §Stages (OD-11) | YES |
| 70 | `docs/s08/operational-runbook.md` | S08 completion criteria | Required before closure; status vocabulary; safety boundary | High | **ACTIVE** | ✅ | — | — | `10_Roadmap` §S08 | NO |
| 71 | `docs/s08/schema-mapping.md` | Physical schema mapping for S08 | Concept→table mapping; master-lease note; gaps | High | **ACTIVE** | ⚠️ ("Default EGP, 2 dp" & "journal_lines EGP 2 dp" conflict with canonical OMR-3dp; runbook itself forbids assuming EGP — C-03) | — | 0011/constitution currency policy | `06_Architecture` §Data dictionary (conflict logged) | YES (currency heritage C-03) |

## G. `docs/audits/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 72 | `docs/audits/2026-07-07-workflow-audit-ar.md` | Workflow audit (34 KB) | Source of FGR-008…013; daily contracts/master-lease/utility/maintenance gaps | Historical (findings extracted) | **OBSOLETE** | ❌ (its open items live on as FGRs + ADR 0001 decisions) | FEATURE_GAP_REGISTER | — | `09_Feature_Catalog`, `10_Roadmap` | NO (already archived-value; deletion proposal) |
| 73 | `docs/audits/COMPETITIVE_BENCHMARK_20260724.md` | Market benchmark | AppFolio/Buildium/Yardi/DoorLoop/etc.; Gulf localization analysis | Strategic | **PARTIALLY VALID** | ⚠️ ("Rentrix (Current)" column dated; target-state guidance still useful) | — | — | `02_Product_Vision` §Market position | NO |
| 74 | `docs/audits/FINANCIAL_DIRECT_WRITE_SURFACE_AUDIT_AR.md` | Direct-write surface audit (PR-C) | Table-by-table closure status; commissions gap closed via atomic RPCs | High (record) | **ACTIVE** | ⚠️ (partially superseded by S02-T06 for payments/expenses) | execution/S02_T06 doc | — | `06_Architecture` §Write boundaries | NO |
| 75 | `docs/audits/MALEK_OPERATIONAL_REAL_REDESIGN_AUDIT.md` | PR #1359 record | Operational redesign scope/treatment | Medium | **ACTIVE** (record) | ✅ | — | — | `08_Brand_Design` §Rollout log | NO |
| 76 | `docs/audits/MALEK_VISUAL_WAVE_1_CONFORMANCE_AUDIT.md` | PR #1357 conformance | Raw-palette sweep + corrections | Medium | **ACTIVE** (record) | ✅ | — | — | `08_Brand_Design` §Rollout log | NO |
| 77 | `docs/audits/MALEK_VISUAL_WAVE_2_FINANCE_REPORTING_AUDIT.md` | PR #1358 conformance | Finance/reporting route inventory + treatment | Medium | **ACTIVE** (record) | ✅ | — | — | `07_UX_Bible` §Finance IA | NO |
| 78 | `docs/audits/MALEK_VISUAL_WAVE_2_POST_MERGE_REVIEW.md` | Post-merge review | Status-badge duplication fix; test correction | Medium | **ACTIVE** (record) | ✅ | — | — | `08_Brand_Design` §Rollout log | NO |
| 79 | `docs/audits/MIGRATION_ROLLBACK_HYGIENE_AUDIT_AR.md` | Rollback hygiene inventory (PR-D) | Every rollback-ish file classified; legacy applied rollback | High | **ACTIVE** | ✅ | database/MIGRATION_AND_ROLLBACK_POLICY_AR | — | `06_Architecture` §Migrations | NO |
| 80 | `docs/audits/OWNER_SETTLEMENT_DUPLICATION_DIAGNOSTIC_AR.md` | FA-003 read-only diagnostic | Duplication probes + backfill gate function | High (record) | **ACTIVE** | ✅ | SETTLEMENT_ITEM_RESERVATION_DESIGN_AR | — | `04_Accounting` §Settlements | NO |
| 81 | `docs/audits/P0_MULTI_TENANT_VERIFICATION_20260723.md` | P0 isolation proof + fix | Causal leak table L1–L10; restrictive policy fix; 19/19 rollback | Historical (merged & live-verified) | **OBSOLETE** (status) | ❌ (fixed; kept as evidence) | NEXT.md P0 section | — | `06_Architecture` §Multi-tenancy | NO (deletion/archive proposal) |
| 82 | `docs/audits/P1_OWNER_SETTLEMENT_INTEGRITY_20260723.md` | P1 settlement server-derivation | Client-trusted amounts fixed; 2 deferred policy notes (fee months basis; master-lease basis) | Historical (merged) | **OBSOLETE** (status) | ❌ (policy notes later decided by 0011-D02/D07) | NEXT.md P1 | 0001/0011 (master-lease + fee cadence alignment) | `04_Accounting` §Settlements | NO |
| 83 | `docs/audits/PHASE2_FINANCIAL_INTEGRITY_REPORT_20260724.md` | Phase-2 report recovery | 6 broken rpt_* RPCs recovered | Historical | **OBSOLETE** | ❌ | — | — | `09_Feature_Catalog` (reports status) | NO |
| 84 | `docs/audits/PHASE3A1A_CANONICAL_ACCOUNT_RESOLUTION.md` | 3A-1A record (PR #1280) | Expenses/deposits canonical resolution | Historical | **OBSOLETE** | ❌ | 0003 | — | `04_Accounting` | NO (deletion/archive proposal) |
| 85 | `docs/audits/PHASE3A1B_INVOICE_PAYMENT_RECEIPT_VOID.md` | 3A-1B record (PR #1281) | Invoice/payment/receipt/VOID scoping | Historical | **OBSOLETE** | ❌ | 0005 | — | `04_Accounting` | NO |
| 86 | `docs/audits/PHASE3A1C_OWNER_SETTLEMENT_ACCOUNT_RESOLUTION.md` | 3A-1C record (PR #1282) | Settlement account resolution | Historical | **OBSOLETE** | ❌ | 0006 | — | `04_Accounting` | NO |
| 87 | `docs/audits/RENTRIX_COMPREHENSIVE_AUDIT_20260725.md` | Sweep audit | P1 text/uuid property fix applied; P2/P3 notes | Historical (fix merged) | **OBSOLETE** | ❌ | — | — | — | NO (deletion/archive proposal) |
| 88 | `docs/audits/RENTRIX_FULL_PRODUCT_AUDIT_20260724.md` | Full system audit | Module-by-module status; tenant-identity shift; interval vulnerabilities | Historical | **OBSOLETE** | ❌ (issues fixed or FGR'ed) | — | — | — | NO |
| 89 | `docs/audits/SECURITY_DEFINER_COMPANY_ISOLATION_AUDIT_AR.md` | FA-004 agreement-isolation fix | `update_owner_agreement_atomic` hardened | Historical (merged) | **OBSOLETE** | ❌ | execution/S02 inventory | — | `06_Architecture` §Security | NO |
| 90 | `docs/audits/TARGET_PRODUCT_ARCHITECTURE_20260724.md` | Target architecture vision | Unified COA vision, trust layers, drill-down | Historical vision | **OBSOLETE** | ❌ (superseded by 0009/0010 + Stage-3 implementation; COA numbering conflicts C-04) | 0010 | Stage-3 reality | `06_Architecture` (historical pointer) | NO |

## H. `docs/archive/` (intentionally archived 2026-07-23/25)

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 91 | `docs/archive/README.md` | Archive rationale | Why files sit here; docs policy exception | Process | **ACTIVE** | ✅ | docs/README policy | — | — | YES (D-1: keep-vs-delete archive policy) |
| 92 | `archive/CURRENT_STATE_2026-07-19.md` | Old current-state | Consolidated into APP_STATUS 2026-07-23 | Historical | **OBSOLETE** | ❌ | APP_STATUS | — | — | YES (D-1) |
| 93 | `archive/PROJECT_STATUS_2026-07-23.md` | Old project status | Pre-APP_STATUS | Historical | **OBSOLETE** | ❌ | APP_STATUS | — | — | YES (D-1) |
| 94 | `archive/RELEASE_BLOCKER_GATE_2026-07-15.md` | Old gate narrative | Gate definition supplanted by workflow | Historical | **OBSOLETE** | ❌ | .github/workflows/release-blocker-gate.yml | — | — | YES (D-1) |
| 95 | `archive/RELEASE_BLOCKERS.md` | Historical blockers RB-001/002 | Closed via PR #1180 | Historical | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 96 | `archive/INTEGRATED_TODO_LIST.md` | Phase-0 execution list (2026-07-18) | All items completed/closed later | Historical | **OBSOLETE** | ❌ | NEXT.md | — | — | YES (D-1) |
| 97 | `archive/MODERN_FORMS_AND_PDF_TODO_LIST.md` | Overlay forms + Arabic PDF plan | All boxes [x] | Historical | **OBSOLETE** | ❌ | documents/PR2-3 | — | Forms/PDF contract → `07_UX_Bible` | YES (D-1) |
| 98 | `archive/ui-2026-07-11-phase/PHASE_0_UX_FOUNDATION_EVIDENCE.md` | UX foundation evidence (PR #1156) | BottomSheet/EntityForm baselines | Historical | **OBSOLETE** | ❌ | ui-ux specs | — | `07_UX_Bible` (contract summaries) | YES (D-1) |
| 99 | `archive/ui-2026-07-11-phase/UI_UX_RELEASE_READINESS_PLAN.md` | UX release plan | Superseded plan | Historical | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 100 | `archive/ui-2026-07-11-phase/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` | Route-by-route UX audit (41 KB) | Still referenced by CONTEXT_MAP for nav work | Mixed | **PARTIALLY VALID** (reference) | ⚠️ (referenced as mandatory reading but content is pre-redesign) | — | — | `07_UX_Bible` §Navigation (then de-reference) | YES (D-1 + reference cleanup) |
| 101 | `archive/ui-2026-07-11-phase/UX_REFACTOR_DELIVERY_20260711.md` | UX refactor delivery | 86/100 score notes | Historical | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 102 | `archive/ui-2026-07-11-phase/UX_RELEASE_CANDIDATE_POLISH_20260711.md` | RC polish notes | Shared-component unification | Historical | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |

## I. `docs/ui-ux/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 103 | `ui-ux/MALEK_VISUAL_CONTRACT_V2.md` | Enforceable V2 visual contract | Composition/behavior/hierarchy rules; Dashboard-first scoping | Critical | **ACTIVE** | ✅ (extended by 0013/0014/Wave-3) | 0012 | — | `08_Brand_Design` | NO |
| 104 | `ui-ux/MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md` | V2 scoped token proposal | Token deltas for Dashboard proof | High | **ACTIVE** | ✅ (Wave-3 tokens now shipped — doc is the proposal record) | tokens.css (live) | — | `08_Brand_Design` | NO |
| 105 | `ui-ux/RENTRIX_VISUAL_DIRECTION.md` | Rentrix visual direction v2.0 | Enterprise Minimalism principles, palette, typography | Superseded for future work | **PARTIALLY VALID** | ⚠️ (docs/README: MALEK V2 governs future work; principles overlap heavily) | MALEK_VISUAL_CONTRACT_V2 | — | `08_Brand_Design` §Design heritage | NO |
| 106 | `ui-ux/RENTRIX_MOBILE_UX.md` | Mobile UX spec v2.0 | Viewports, nav, touch targets | Superseded for future work | **PARTIALLY VALID** | ⚠️ | MALEK contract + Wave-3 | — | `07_UX_Bible` §Mobile | NO |
| 107 | `ui-ux/RENTRIX_COMPONENT_CONTRACT.md` | Component contract v2.0 | 18 shared components API/visual spec | Superseded for future work | **PARTIALLY VALID** | ⚠️ (AppShell spec says "top accent bar REMOVED", sidebar 256/72 — verify vs current) | wave-3 inventory | — | `07_UX_Bible` §Components | NO |
| 108 | `ui-ux/RENTRIX_FINANCIAL_PRESENTATION.md` | Financial presentation spec | Amount typography; **Arabic numerals 3dp example** | Superseded in part | **PARTIALLY VALID** | ⚠️ (conflict C-06: code forces Latin numerals `-u-nu-latn` since #1298) | 0014 status/presentation sections | formatters.ts (Latin numerals) | `07_UX_Bible` §Amount presentation (conflict logged) | YES (confirm Latin-numeral standard C-06) |
| 109 | `ui-ux/RENTRIX_FULL_PRODUCT_AUDIT.md` | UX product audit (2026-07-15) | 12-screen audit | Historical | **OBSOLETE** | ❌ | — | — | — | NO (deletion/archive proposal) |
| 110 | `ui-ux/PHASE3_FULL_SCREEN_POLISH_EVIDENCE.md` | Phase-3 polish evidence | Login/dashboard polish | Historical | **OBSOLETE** | ❌ | — | — | — | NO |
| 111 | `ui-ux/PR1_FOUNDATION_EVIDENCE.md` | PR #1174 evidence | Design-token rebuild notes | Historical | **OBSOLETE** | ❌ | — | — | — | NO |
| 112 | `ui-ux/PR1_VISUAL_EVIDENCE.md` | PR #1174 CI evidence | CI matrix record | Historical | **OBSOLETE** | ❌ | — | — | — | NO |

## J. `docs/handover/`, `docs/agent-context/`, `docs/documents/`, `docs/decisions` done above

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 113 | `handover/HANDOVER_CHECKLIST.md` | Operator handover checklist | Env, DB, roles, deploy, backup, monitoring | High (operational) | **ACTIVE** | ⚠️ (pnpm pinned 10.11.1 stated; roles `{\"role\": \"ADMIN\"}` metadata style predates company_members model — verify) | — | MULTI_TENANT (company membership) | `11_Current_Status` §Operations | NO |
| 114 | `handover/POST_LAUNCH_BACKLOG.md` | Post-launch backlog PL-001…004 | Deferred-revenue RPC, zod unification, test-log cleanup, WhatsApp sending | High (open ideas) | **ACTIVE** | ✅ (still open) | — | — | `10_Roadmap` §Post-launch | NO |
| 115 | `handover/FORGOTTEN_PLANS_TODO_LIST.md` | Forgotten plans & debt | 5 open (master-lease schedule, split maintenance, utilities, multi-currency, tenant cascade protection) + 5 done | High (open items unique) | **PARTIALLY VALID** | ⚠️ (open items overlap FGR/S05 + decisions) | FEATURE_GAP_REGISTER, 10-stage plan | — | `10_Roadmap` §Open work streams | NO |
| 116 | `handover/FINAL_DELIVERY_AUDIT.md` | 2026-07-15 NO-GO audit (36 KB) | UTC-slicing P0 + mocked settlements/deposits P1 — all closed later | Historical | **OBSOLETE** | ❌ | archive/RELEASE_BLOCKERS | — | — | NO (deletion/archive proposal) |
| 117 | `agent-context/CONTEXT_MAP.md` | Task-routing authority | What to read per task row | High | **ACTIVE** | ⚠️ (multiple rows point at archived `docs/CURRENT_STATE.md`; references archive UX audit) | — | Dangling refs | Updated routing summarized in `06_Architecture` §Contributor path | YES (D-5 reference repair) |
| 118 | `agent-context/DOMAIN.md` | High-risk domain notes | Invariants, violations, unknowns | High | **PARTIALLY VALID** | ⚠️ ("Product decision required" items were all decided in ADR 0001/0011) | DOMAIN.md | 0001/0011 | `06_Architecture` §Invariants + `12_Open_Decisions` (cleaned) | YES (D-5 refresh) |
| 119 | `agent-context/WORKFLOW.md` | High-risk workflow | Explore→scope→trace→invariants→implement→test→verify | High | **ACTIVE** | ✅ | — | — | — | NO |
| 120 | `documents/PR2_CALLER_INVENTORY.md` | Document platform PR-2 | All 17 callers migrated to documentService | Medium (record) | **ACTIVE** | ✅ | — | — | `09_Feature_Catalog` (docs platform) | NO |
| 121 | `documents/PR3_BROWSER_ACCEPTANCE.md` | Document platform PR-3 | Browser acceptance matrix | Medium (record) | **ACTIVE** | ✅ | — | — | `07_UX_Bible` §Print/PDF | NO |

## K. `evidence/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 122 | `evidence/p0/inventory.md` | P0 surface inventory | 68 tables/92 functions sweep | Historical evidence | **OBSOLETE** (snapshot) | ❌ | audits/P0 | — | — | YES (D-1) |
| 123 | `evidence/p0/rpc-security-matrix.md` | P0 function matrix | 92-function security props | Historical evidence | **OBSOLETE** (snapshot) | ❌ (static; drift) | execution/S02 inventory | — | — | YES (D-1) |
| 124 | `evidence/p0/fn-coverage.md` | P0 rollback coverage | 19/19 functions covered | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 125 | `evidence/p0/cause/env-parity.md` | PGlite↔Supabase parity notes | Env differences documented | Historical evidence | **OBSOLETE** | ❌ | — | — | `06_Architecture` §Testing doctrine | YES (D-1) |
| 126 | `evidence/p1/approve-failure-classification.md` | P1 failure classification | 42501 env-parity classification | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 127 | `evidence/preflight/ci_hardening_pr_summary.md` | CI hardening record | Sonar gate repair notes | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 128 | `evidence/preflight/migration_evidence_diff_diagnostic_fixture.md` | Fixture excerpt | Test fixture output | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 129 | `evidence/preflight/production_access_backup_preflight_summary.md` | Preflight access record | 2026-07-21 snapshot w/ historical notice | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 130 | `evidence/preflight/production_live_reconciliation_20260721.md` | Live reconciliation record | 2026-07-21 read-only snapshot | Historical evidence | **OBSOLETE** | ❌ (says project "RENTRIX EGY (live)") | — | C-03 context | — | YES (D-1) |
| 131 | `evidence/preflight/qa_residue_inventory_20260721.md` | QA residue inventory | TEST-QA entity graph | Historical evidence | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 132 | `evidence/preflight/migration_evidence_no_credentials.txt` | Preflight env note | No-credential status output | Historical | **OBSOLETE** | ❌ | — | — | — | YES (D-1) |
| 133 | `evidence/dashboard-v2-visual-redesign/IMPLEMENTATION_NOTE.md` | Dashboard V2 proof note | Contract/V2/ADR-0012 mapping | Medium (record) | **ACTIVE** | ✅ | — | — | `08_Brand_Design` | NO |
| 134 | `evidence/s08/FINAL_REPORT.md` | S08 evidence report (PR #1366 draft) | Fixture-based; 26 files | Mixed | **PARTIALLY VALID** | ⚠️ (docs/s08/FINAL_REPORT.md declares S08 not complete; OD-11) | docs/s08/* | — | `11_Current_Status` §S08 | YES |
| 135 | `evidence/s08/README.md` | S08 evidence package readme | Fixture-based package list | Mixed | **PARTIALLY VALID** | ⚠️ | — | — | — | YES (with OD-11) |
| 136 | `evidence/s08/approval-template.md` | S08 approval template | Reviewer checklist | Medium | **ACTIVE** | ✅ | — | — | — | NO |

## L. `tickets/`, `rentrix-app/docs/`, `supabase/`

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 137 | `tickets/owner-settlements-fgr-005.md` | Feature ticket (FGR-005) | Owner settlements UI wiring | Historical (implemented) | **OBSOLETE** | ❌ | FGR-005 (closed) | — | — | NO (deletion proposal) |
| 138 | `rentrix-app/docs/wave-3-design-system-inventory.md` | Wave-3 inventory | Foundation reuse map; primitives inventory | High (record) | **ACTIVE** | ✅ (shipped in #1368) | — | — | `08_Brand_Design` | NO |
| 139 | `rentrix-app/docs/wave-4a-enterprise-ux-foundation.md` | Wave-4A enterprise layer doc | Composition layer: page shells, tables, drawers, forms | High (record) | **ACTIVE** | ✅ (shipped in #1369) | — | — | `07_UX_Bible` §Enterprise layer | NO |
| 140 | `supabase/migrations/README.md` | Migration chain guidance | Naming; baseline reconstruction; ledger notes | High | **ACTIVE** | ⚠️ ("110 exact entries" and "164 files" counts stale → 189 files today; drift audit lists 14 repo-only files) | — | S02_LIVE_DRIFT_AUDIT | `06_Architecture` §Migrations | YES (D-3/D-5 style refresh) |
| 141 | `supabase/migrations/rls_per_table/01_table_order.md` | RLS enable order | Grouped table rollout order | Historical | **OBSOLETE** | ❌ (RLS long since applied across) | — | — | — | NO (deletion proposal) |

## M. `.agents/` (agent tooling — not product documentation; inventoried for completeness)

| # | Location | Purpose | Summary | Relevance | Category | Reality | Duplicated with | Conflicts with | Merge into | Owner decision? |
|---|---|---|---|---|---|---|---|---|---|---|
| 142 | `.agents/skills/README.md` | Skill index + selection rules | 15 skills; pruning history | Tooling | **ACTIVE** | ✅ | — | — | — | NO |
| 143 | `.agents/skills/EXTERNAL_SOURCES.md` | Vendored-source provenance | Upstream revisions + license notes | Tooling | **ACTIVE** | ✅ | — | — | — | NO |
| 144–158 | `.agents/skills/*/SKILL.md` (15 skills: frontend-integration, supabase-data-contracts, financial-reporting, testing-release-readiness, react-patterns, react-testing, postgres-patterns, database-migrations, security-review, superpowers-systematic-debugging, error-handling, vite-patterns, browser-qa, design-system, frontend-a11y, ui-ux-pro-max) | Working playbooks | Stack-specific engineering guidance | Tooling | **ACTIVE** | ✅ (`financial-reporting` maps to FGRs; `ui-ux-pro-max` governs visual work) | — | — | — | NO |
| 159 | `.agents/skills/security-review/cloud-infrastructure-security.md` | Security skill annex | Cloud security checklist | Tooling | **ACTIVE** | ✅ | — | — | — | NO |
| 160 | `.agents/skills/superpowers-systematic-debugging/{CREATION-LOG,condition-based-waiting,defense-in-depth,root-cause-tracing,test-academic,test-pressure-1,2,3}.md` (8 files) | Debugging skill annexes | Skill support files | Tooling | **ACTIVE** | ✅ | — | — | — | NO |
| 161 | `.agents/guardrails/LESSONS_LEARNED.md` | Production incident memory | ID-type mismatches, FK/type rules — mandatory reading | High (lessons) | **ACTIVE** | ✅ | — | — | `06_Architecture` §Invariants (referenced) | NO |
| 162 | `.agents/commands/README.md` + `commands/{new-feature,implement-db,implement-api,implement-ui,verify-feature,close-feature,run-all-checks}.md` + `prompts/ticket-template.md` (9 files) | Agent slash-commands | Roles workflow: ticket→db→api→ui→verify→close | Tooling | **ACTIVE** | ⚠️ (`close-feature` says "Updates CURRENT_STATE" — archived target) | — | Dangling CURRENT_STATE ref | — | YES (D-5 reference repair) |
| 163 | `.github/ISSUE_TEMPLATE/feature_request.md` | Issue template | Standard GH template | Tooling | **ACTIVE** | ✅ | — | — | — | NO |

## N. Summary counts

| Category | Count |
|---|---|
| ACTIVE | 78 |
| PARTIALLY VALID | 31 |
| DUPLICATED | 1 |
| OBSOLETE | 49 |
| DECISION REQUIRED | (17 files carry YES owner-decision flags — mostly deletion-policy and reconciliation items; business conflicts themselves live in `12_Open_Decisions.md` / `13_Conflict_Report.md`) |

> Note: a document can be PARTIALLY VALID **and** carry an owner-decision flag (e.g. `README.md` brand line, `GOVERNANCE_LOG.md` backfill). Owner-decision flags here concern *what to do with the document*; unresolved *business* conflicts are catalogued in `12_Open_Decisions.md` with IDs OD-xx and conflicts C-xx.
