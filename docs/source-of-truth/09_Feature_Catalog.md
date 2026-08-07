# MALEK — Feature Catalog (Canonical)

> **Critical deliverable of the documentation consolidation (2026-08-07).** Every feature discovered across all 166 documentation files, with purpose, verified implementation status, and every document where it appeared. Statuses are verified against code and git history where possible; doc-only claims that could not be verified are marked as such. "Appears in" lists the doc sources (abbreviated paths; all under `docs/` unless noted). Status legend: **Implemented** (merged + verified) / **Partial** (some parts live, decision-relevant gaps open) / **Not implemented** (decided or proposed only) / **Removed/Replaced**.

---

## A. Platform & administration

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| A1 | Multi-tenant SaaS isolation (`companies`, `company_members`, JWT `app_metadata.company_id`, `current_company_id()`, `*_company_isolation` RLS) | One deployment serves many offices; strict per-company data isolation | **Implemented** (2026-07-22 migration + P0 `p0_tenant_isolation` wave) | MULTI_TENANT_ARCHITECTURE, SECURITY_MODEL, ENGINEERING_GOVERNANCE, execution/10_STAGE_*, s08 runbook, APP_STATUS |
| A2 | Auth & app roles (ADMIN/MANAGER/USER; helpers `current_app_role` etc.) | Authentication via Supabase Auth; role-based authorization in RLS/RPC/route guards | **Implemented** (3-role reality; 6-role canonical expansion is C-05/OD-04) | SECURITY_MODEL, adr/0003-financial-security…, ENGINEERING_GOVERNANCE, TESTING |
| A3 | Audit log (`audit_log` + triggers + Audit log page) | Immutable record of sensitive mutations | **Implemented** (`function_search_path_mutable` advisory open on `audit_journal_entry_insert`) | DATABASE_ARCHITECTURE, SECURITY_MODEL, APP_STATUS, PRODUCTION_HARDENING_AUDIT |
| A4 | Data integrity page | Operator-facing integrity diagnostics | **Implemented** | APP_STATUS, RELEASE_READINESS, ARCHITECTURE (admin workspace) |
| A5 | Settings (company profile, cost centers, payment terms, document prefixes) | Office configuration | **Implemented** | PHASE_0_SETTINGS_AUTH_AUDIT, APP_STATUS, ARCHITECTURE |
| A6 | PWA (manifest, service worker, installable, MALEK icons) | Mobile-first installable app | **Implemented** | README, brand/MALEK_ASSET_CONTRACT, ui-ux evidence |
| A7 | Print/PDF document platform (`documentService`) | Unified printable financial/legal documents | **Implemented** (PR2 all 17 callers migrated; PR3 acceptance) | documents/*, ui-ux/PR1_*_EVIDENCE, execution ledgers |
| A8 | Documents vault (private storage + signed URLs) | Contract/entity document storage | **Implemented** | ARCHITECTURE, DATABASE_ARCHITECTURE, APP_STATUS |
| A9 | CSV export (reports/lists) | Data portability | **Implemented** | ARCHITECTURE (`csvExport.ts`), RENTRIX_FULL_PRODUCT_AUDIT |
| A10 | AI assistant (read-only, 4 actions) | Arabic conversational data queries | **Implemented** (read-only scope) | APP_STATUS, NEXT, ARCHITECTURE (reports workspace) |
| A11 | Automation (6 active rules, WhatsApp channel) | Reminders/scheduled messaging | **Implemented** (auto-dispatch queue based; auto-send is PL-004, not implemented) | APP_STATUS, FEATURE_GAP_REGISTER, ROADMAP references |
| A12 | Communication log (`communication_records`) | Track owner/tenant communications | **Implemented** | DATABASE_ARCHITECTURE (pagination set), APP_STATUS |
| A13 | Notifications | In-app alerts | **Partial** (operational alerts exist on dashboard; no dedicated notification center doc-verified) | RENTRIX_FULL_PRODUCT_AUDIT, dashboards docs |
| A14 | Subdomain per-tenant routing | SaaS vanity URLs | **Not implemented** (open question) | MULTI_TENANT_ARCHITECTURE (future), Open Decisions |

## B. Portfolio (owners, properties, units, lands)

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| B1 | Properties CRUD + 3-step creation wizard | Manage buildings/properties incl. ownership & units steps | **Implemented** (merged 2026-08 consolidation) | ARCHITECTURE §2026-08, APP_STATUS, ui-ux evidence |
| B2 | Property 360 workspace (8 URL-addressable tabs) | Single property command center | **Implemented** | ARCHITECTURE, ui-ux/PHASE3_FULL_SCREEN_POLISH_EVIDENCE |
| B3 | Units (derived status) | Rentable units; status derived from contracts | **Implemented** | DOMAIN, DATABASE_ARCHITECTURE, APP_STATUS |
| B4 | Lands | Land-parcel management | **Implemented** (forms not yet zod-unified — PL-002) | APP_STATUS, FEATURE_GAP_REGISTER (PL-002), ARCHITECTURE |
| B5 | Authoritative ownership model (`property_owners`, `owner_agreements`, `current_property_ownership` view, projection trigger) | Multi-owner % + time validity; agreements authoritative; `properties.owner_id` demoted to projection | **Implemented** (2026-08 wave; compat fields remain in legacy report views) | ARCHITECTURE, DATABASE_ARCHITECTURE, s08 schema-mapping |
| B6 | Owners directory | Owner records | **Implemented** | APP_STATUS, DOMAIN, RPC_REFERENCE |

## C. Relations & contracts

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| C1 | People directory (`people`) | Unified person records | **Implemented** | DATABASE_ARCHITECTURE, APP_STATUS |
| C2 | Tenants | Tenant records (legacy `tenants` table retained supporting) | **Implemented** (cascade-delete protection NOT implemented — FORGOTTEN #5) | DATABASE_ARCHITECTURE, DOMAIN, Open Decisions |
| C3 | Contracts: atomic create/update/renew/terminate/soft-delete RPCs; 4-state lifecycle | Lease lifecycle with financial invariants | **Implemented (current 4-state)**; canonical **8+2-state lifecycle w/ approval & signature flow NOT implemented (S04)** → Partial against LOCKED target | FEATURE_GAP_REGISTER (FGR-004), execution/10_STAGE_* (S04), decisions/0011 (D-series), business constitution |
| C4 | Contract documents | Attachments per contract | **Implemented** | DATABASE_ARCHITECTURE, documents/* |
| C5 | Payment terms templates | Reusable payment schedules | **Implemented** | DATABASE_ARCHITECTURE, PHASE_0 audit |
| C6 | Leads pipeline | Prospect tracking | **Implemented** (zod unification pending PL-002) | APP_STATUS, ARCHITECTURE |
| C7 | Daily & open-ended contracts | Short-stay/open-ended billing | **Not implemented** (decided ADR 0001; FGR-008) | decisions/0001, FEATURE_GAP_REGISTER, PRODUCT_ACCOUNTING_DECISION_GATES |
| C8 | Maker-checker approvals & signatures for contracts | Formal governance of contract activation | **Not implemented** (D11; S04-T03) | decisions/0011, execution ledgers |

## D. Operations & maintenance

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| D1 | Maintenance records + `resolve_maintenance_with_expense` | Track & resolve maintenance with linked expense | **Implemented** (charge-target at resolution NOT — FGR-010) | ARCHITECTURE, FEATURE_GAP_REGISTER, DOMAIN |
| D2 | Maintenance charge-target (tenant/owner/office) at resolution + split allocation | Bill the right party | **Not implemented** (decided ADR 0001; FGR-010) | decisions/0001, FEATURE_GAP_REGISTER |
| D3 | Utility bills table/page (`utility_bills`) | Record utilities | **Partial** (data structure + page exist; full billing workflow NOT production-ready — FGR-009) | DATABASE_ARCHITECTURE, FEATURE_GAP_REGISTER, decisions/0001 |
| D4 | Automation rules (see A11) | — | — | — |

## E. Finance core

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| E1 | Invoices (issue/manage; atomic contract-driven schedules) | Bill tenants | **Implemented** | DOMAIN, RPC_REFERENCE, APP_STATUS, business constitution |
| E2 | Payments/receipts — payment-backed receipts, shared identity `payments.id = payments.receipt_id` | Collect money; receipt = payment | **Implemented** | decisions/0005, ARCHITECTURE (financial reporting note), FEATURE_GAP_REGISTER FGR-001 |
| E3 | Receipt VOID + balanced reversal (`void_receipt_atomic`) | Cancel erroneous receipts safely | **Implemented** (void accepts client-supplied `p_reverse_entries` — C-08 vs ADR 0005 "clone original account IDs") | decisions/0005, accounting/S03_T01_GL_GAP_AUDIT, TESTING |
| E4 | Expenses + journal RPCs | Office/property expenses with postings | **Implemented** | DATABASE_ARCHITECTURE, RPC_REFERENCE, DOMAIN |
| E5 | Arrears workspace | Track overdue receivables | **Implemented** (page exists; report depth per FGR-002) | ARCHITECTURE, APP_STATUS |
| E6 | Tenant deposits (`tenant_deposits`, liability 2200; create/deduct/refund atomic RPCs) | Hold client money as liability | **Implemented** core lifecycle (statement/installment UX later; FGR-012 closed-for-core) | FEATURE_GAP_REGISTER, ARCHITECTURE §8.2, decisions/0011 |
| E7 | Owner settlements — P1 server-derived (`calculate_owner_net_payout`) + `pay_owner_settlement_atomic` + FA-003 reservation links | Pay owners their net | **Implemented (P1 pilot scope)**; first real settlement to run under ADMIN supervision | FEATURE_GAP_REGISTER FGR-005, decisions/0006, execution/10_STAGE_* (S02) |
| E8 | Commissions (`pay_commission_atomic`/`reverse_commission_atomic`, 6100 expense) | Agent commission payouts | **Implemented** (was missing live — fixed #1361) | ARCHITECTURE, execution/S02_LIVE_DRIFT_AUDIT_20260807, s08 schema-mapping |
| E9 | Bank reconciliation (`/bank-reconciliation`, CSV import fail-closed) | Match bank statement to books | **Partial** (FGR-006: no wizard/OFX/MT940, no duplicate detection, no auto-match suggestions, no final approval flow) | FEATURE_GAP_REGISTER, execution/10_STAGE_* (S02), APP_STATUS |
| E10 | Accounting periods (monthly, hard close) | Period control | **Partial** (GL periods platform shipped in migrations; no first OPEN period live; no live effect) | decisions/0011 (D-series), accounting/S03_T01_GL_GAP_AUDIT, decisions/0010 |
| E11 | Stage-3 GL platform (batches/lines/periods, `gl_create/post_journal_batch`, `post_journal_event`, `reverse_journal_batch`, 18 accounts) | Canonical double-entry core | **Partial — engine shipped, NOT wired**: business RPCs still post via `journal_entries` compat view (`is_legacy_compat=true`, `accounting_period_id=NULL`); `late_posting`/`posting_date` absent | decisions/0009, decisions/0010, accounting/S03_T01_GL_GAP_AUDIT |
| E12 | Multi-currency | Operate beyond OMR | **Not implemented** (FORGOTTEN #4; OD-05; EGP heritage C-03) | business constitution (OMR lock), s08/schema-mapping (EGP claims — stale), Open Decisions |
| E13 | Late fees | Charge on overdue | **Not implemented** (D09; S05-T07) | decisions/0011, execution ledgers |
| E14 | Early termination workflow (canonical) | Fee/settlement rules on early exit | **Not implemented canonically** (S05-T08) | execution/10_STAGE_*, business constitution |
| E15 | Due-from-Owner collection mechanism | Collect negative owner balances | **Not implemented** (OD-08) | decisions/0011 consequences, FEATURE_GAP_REGISTER refs |
| E16 | Credit notes & refunds | Formal reversal docs | **Not implemented (canonical workflow)** (S05 scope) | execution/10_STAGE_* S05 |

## F. Reporting & analytics

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| F1 | Reports hub `/reports` (tabs: collection, cashflow, arrears, accounting, statements, VAT, deferred revenue) | Executive analytics center | **Implemented** (mixed RPC/client wiring — FGR-002 Partial) | decisions/0008, decisions/0014, FEATURE_GAP_REGISTER |
| F2 | `rpt_financial_summary`, `rpt_dashboard_overview` | KPI summaries | **Implemented** | RPC_REFERENCE, APP_STATUS |
| F3 | `rpt_daily_collection` (VOID-excluding rule) | Daily collections | **Implemented** (FGR-001 closed; contract tested) | FEATURE_GAP_REGISTER, ARCHITECTURE note |
| F4 | `rpt_cash_flow` | Cash movement | **Implemented (subledger-based; S07 kernel merged)** | RPC_REFERENCE, execution/10_STAGE_* S07 |
| F5 | `rpt_vat_return` | VAT reporting | **Implemented (operational)**; canonical VAT configurable per S05 Partial | RPC_REFERENCE, execution S05 |
| F6 | `rpt_owner_statement`, `rpt_tenant_statement` | Party statements | **Partial** (FGR-003: wired w/ filters; lifecycle/exports/live verification missing) | FEATURE_GAP_REGISTER, RPC_REFERENCE |
| F7 | `rpt_trial_balance`, `rpt_income_statement`, `rpt_balance_sheet` | Financial statements | **Partial** (read subledgers, not GL — S03 audit) | accounting/S03_T01_GL_GAP_AUDIT, RPC_REFERENCE, decisions/0010 |
| F8 | `rpt_aged_receivables`, `rpt_overdue_invoices`, `rpt_rent_roll` | Receivable analytics | **Implemented** (parity coverage incomplete — FGR-002) | FEATURE_GAP_REGISTER, RPC_REFERENCE |
| F9 | Deferred revenue report | Accrual view of prepaid rent | **Partial** (PL-001: report uses mocked `sampleCollections`) | FEATURE_GAP_REGISTER (FGR-013 + PL-001), decisions/0011 |
| F10 | Dashboard V2 (`[data-visual-contract='v2']`) | Executive home | **Implemented** (#1352) | decisions/0012/0013, ui-ux/MALEK_VISUAL_CONTRACT_V2 |
| F11 | Owner/tenant portals | Self-service external access | **Not implemented** (future idea) | PRODUCT vision docs, Various roadmap mentions |

## G. Governance & quality infrastructure

| # | Feature | Purpose | Status | Appears in |
|---|---|---|---|---|
| G1 | Canonical business-rules guard (CI hash check of constitution) | Prevent silent business-rule drift | **Implemented** | GOVERNANCE.md, business/CANONICAL…AR, workflows |
| G2 | Execution-plan guard (protects governance JSON + GOVERNANCE_LOG) | Ledger integrity | **Implemented** (log itself stale — OD-14) | GOVERNANCE.md, execution/* |
| G3 | Migration evidence preflight (`collect-supabase-migration-evidence.sh`) | Deploy reconciliation | **Implemented** | ARCHITECTURE, TESTING |
| G4 | Guard v2 architecture boundary (`check-architecture.mjs`) | Dependency ratchet | **Implemented** (8 frozen debts) | ARCHITECTURE |
| G5 | Rollback files convention (32 files) | Safe reversal | **Implemented (partially manual)** | supabase/rollback/, git log |
| G6 | Seeded staging readiness runbook / disposable-Supabase lifecycle gates | Verification without production mutation | **Implemented** | SEEDED_STAGING_READINESS_RUNBOOK, RELEASE_EVIDENCE_LEDGER, TESTING |
| G7 | Browser-readiness + release-blocker workflows | E2E gates | **Implemented** (243 pass/204 skip/0 fail evidence 2026-07) | RELEASE_READINESS, FEATURE_GAP_REGISTER FGR-007 |
| G8 | S06 master-lease kernel (head lease, ROU/liability schedule kernel) | IFRS-16 master-lease accounting | **Partial** — kernel merged (#1362); NOT reviewer-credited; full module (modifications/remeasurement/elections) open | execution/10_STAGE_* S06, decisions/0011 (D05), git log |
| G9 | S07 reporting & reconciliation kernel | GL-statement/close machinery | **Partial** — merged (#1363); not reviewer-credited | execution S07, git log |
| G10 | S08 read-only historical analysis (T01–T10) | Frozen inventory of historical drift | **Partial/contested** — merged (`8e4908a7`) despite s08 FINAL_REPORT stating NOT ready for independent review (OD-11) | s08/* (FINAL_REPORT, operational-runbook, schema-mapping), execution ledgers |
| G11 | S09 historical correction (append-only correction batches) | Fix history safely | **Not implemented** (forbidden before S08 credited) | execution/10_STAGE_* |
| G12 | S10 acceptance matrix/live gates/pilot sign-off | Launch gate | **Not implemented** | execution/10_STAGE_* |

## H. Removed / Replaced

| # | Feature | What happened | Appears in |
|---|---|---|---|
| H1 | `properties.owner_id`/`owner_name` as source of truth | **Replaced** by `property_owners`+`owner_agreements`; kept as trigger-synced projection | ARCHITECTURE §8.1, s08/schema-mapping |
| H2 | Legacy finance pages (pre-hub URLs) | **Replaced** by finance hubs with legacy redirects (ADR 0014) | decisions/0014 |
| H3 | Dashboard V1 | **Replaced** by Dashboard V2 (#1352) | decisions/0013 |
| H4 | `malik-mark.svg` visible usage | **Removed from runtime** (file residue on disk) | brand/MALEK_ASSET_CONTRACT, ADR 0011 |
| H5 | Legacy raster icons (`icon-rentrix-*.png`) in manifest/head/precache | **Removed from all runtime references** (files retained unreferenced) | ARCHITECTURE "Legacy brand assets" |
| H6 | Direct client writes to `contracts` | **Removed** (FGR-004 closed; atomic RPC only) | FEATURE_GAP_REGISTER |
| H7 | Residual financial direct-write RLS policies | **Removed** (`f87b5002`; RPC-only write path) | git log, S02 hardening |

---

## Coverage notes

- Features decided in the LOCKED constitution/ADR 0011 but not yet implemented map 1:1 to roadmap streams in `10_Roadmap.md` (Phase C).
- "Appears in" is exhaustive at doc-group granularity; per-file mapping for all 166 docs lives in `01_Documentation_Inventory.md`.
- Any feature claim found in evidence files that contradicts this table (e.g., stage ledgers claiming completeness git does not support) is treated as ledger drift — see `11_Current_Status.md` and `13_Conflict_Report.md`.
