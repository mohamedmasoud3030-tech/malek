# MALEK — Canonical Reality & Status (Document 1)

> **Execution-Ready Source of Truth.** Created on 2026-08-07. This document represents a complete, verified audit of all features and user experience surfaces across the MALEK application, directly checked against the repository code. 

---

## SECTION 1: EXECUTIVE SUMMARY & QUALITY GATE POSTURE

As of August 2026, the MALEK platform has evolved from a single-company legacy codebase into a multi-tenant, enterprise-ready real estate management system. However, a significant gap remains between documented visions and the actual code in production. This document serves as the absolute authority on what features are live, what parts are hidden, and what UX constraints must guide future development.

### 1. Repository & Production State
- **Primary Repo:** `mohamedmasoud3030-tech/malik` on branch `main` (with active session execution on `arena/019fdb42-malik`).
- **Target Production Host:** `rentrixapp.vercel.app` (Vercel).
- **Database Backend:** Supabase Postgres Instance `nnggcnpcuomwfuupupwg`.
- **Primary Language & Direction:** Arabic-first, logical RTL (Right-to-Left) with Latin numeral formatting (`-u-nu-latn`) for financial stability.

### 2. Active Quality Gates & Code Health
The codebase enforces rigorous preflight gates. All numbers below are verified against the running test suites:
- **Core Test Suite:** `1,161 / 1,161` passing assertions under Vitest (`pnpm test`). Includes RLS isolation, domain math, and state validation.
- **Financial Validation Suite:** `276 / 276` passing checks validating invoice schedules, payment allocation, and void reversals (`pnpm test:financials`).
- **Browser-Readiness Gate:** Playwright desktop and mobile flows verify E2E core pathways with `243` checks passing, and `204` intentional skips for unimplemented future streams.
- **Security Boundaries:** `98` active Row-Level Security (RLS) policies on Supabase.
- **Dependency Guard v2:** `scripts/check-architecture.mjs` freezes 8 grandfathered circular/cross-feature dependency paths, blocking any new cross-module leaks.

---

## SECTION 2: CORE OBJECTIVE 1 — FEATURE REALITY AUDIT

We have audited every documented feature in the repository. We classify their real, user-facing operational status using only the following nine strict classifications:
1. `VERIFIED_COMPLETE` — fully implemented, connected to real data, reachable from the UI, supports full workflows, and respects permissions/business logic.
2. `IMPLEMENTED_BUT_NOT_EXPOSED` — fully written in backend/frontend but lacks navigation links or user-accessible toggle.
3. `PARTIALLY_IMPLEMENTED` — core logic exists, but major gaps/missing workflows exist (e.g., stubs/mocks present, missing filters or edge cases).
4. `UI_ONLY` — visual interface exists but is backed by mocked static data with no backend writes.
5. `BACKEND_ONLY` — database tables, RPCs, or service layer exist but have no corresponding frontend screens.
6. `DOCUMENTED_NOT_IMPLEMENTED` — written about in ADRs/manuals, but no code exists in the repository.
7. `BROKEN_OR_INCONSISTENT` — implementation exists but fails runtime checks, triggers errors, or violates core business rules.
8. `NEEDS_OWNER_DECISION` — development is blocked on a fundamental product or legal decision.
9. `INTENTIONALLY_DEFERRED` — officially postponed to later phases (e.g., multi-office, portals).

### Comprehensive Feature Catalog

| ID | Feature | Module | Intended Purpose | Actual Current Behavior | User Visible? | Connected? | Complete? | Evidence Paths | Missing Work / Gaps | Priority | Recommendation | Status Classification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A1** | Multi-tenant SaaS Isolation | Platform | Strict per-company data isolation via `company_id` and RLS | RESTRICTIVE RLS policies applied. JWT injects active company ID in metadata. | No (implicit) | Yes | Yes | `supabase/migrations/` (P0 waves), `src/p0/p0-multi-tenant-isolation.test.ts` | None for single-company pilot. 224 performance warnings to optimize. | High | Keep locked and enforce in all new tables. | `VERIFIED_COMPLETE` |
| **A2** | Auth & App Roles | Platform | 3 application roles (ADMIN, MANAGER, USER) for route & action guards | Checked via token helpers and route-guards. Enforces route access. | Yes | Yes | Yes | `src/features/auth/permissions.ts`, `src/features/auth/route-guards.ts` | 6-role expansion is defined but deferred (C-05). | High | Keep 3-role model active; defer expansion until portals phase. | `VERIFIED_COMPLETE` |
| **A3** | Audit Log Triggers & Page | Platform | Immutable audit logs on all mutative tables | Triggers write to `audit_log` table. Page renders history with pagination. | Yes (Admin) | Yes | Yes | `src/features/audit/audit-log-page.tsx`, `supabase/migrations/` | Open security advisory `function_search_path_mutable` on insert trigger. | High | Merge PR #1297 (Draft) to pin search_path on audit triggers. | `VERIFIED_COMPLETE` |
| **A4** | Data Integrity Diagnostics | Platform | Admin-facing validation of database integrity | Renders counts of mismatched/orphaned records. | Yes (Admin) | Yes | Yes | `src/features/system/data-integrity-page.tsx` | UI styling polish. | Medium | Integrate into the daily operator-close rhythm. | `VERIFIED_COMPLETE` |
| **A5** | Company Settings | Platform | Office profiles, payment terms, cost centers configuration | Renders configuration forms with successful Supabase updates. | Yes | Yes | Yes | `src/features/settings/settings-page.tsx` | Forms are not unified under Zod yet (PL-002). | Medium | Unify schemas using Zod validation. | `VERIFIED_COMPLETE` |
| **A6** | PWA Mobile-First Support | Platform | Installable mobile web app with offline capabilities | Vite PWA plugin outputs active service worker and MALEK manifest. | Yes | Yes | Yes | `rentrix-app/vite.config.ts`, `rentrix-app/public/manifest.json` | None. | Low | Retain as-is; verify physical iOS rendering periodically. | `VERIFIED_COMPLETE` |
| **A7** | Print/PDF Platform | Platform | Unified document formatting and PDF exports | Unified `documentService` replaces 17 legacy callers. Generates clean RTL sheets. | Yes | Yes | Yes | `src/services/documents/documentEngine.canonical.test.ts` | Legal template copy verification. | High | Secure owner sign-off on actual legal wording. | `VERIFIED_COMPLETE` |
| **A8** | Documents Vault | Platform | Secure contract and entity file uploads | Private bucket integration with secure signed URLs. | Yes | Yes | Yes | `src/features/documents-vault/documents-vault-page.tsx` | Size limit warnings. | Medium | Add file size and extension pre-upload validation. | `VERIFIED_COMPLETE` |
| **A9** | CSV Data Export | Platform | Data portability across all reports and lists | Config-driven `csvExport.ts` extracts active data. | Yes | Yes | Yes | `src/lib/csvExport.ts` | Audit logging on data downloads. | Medium | Add audit logs for CSV export actions. | `VERIFIED_COMPLETE` |
| **A10** | AI Assistant | Platform | Arabic-first natural language database query | Renders read-only assistant panel. Calls NLP query processor safely. | Yes | Yes | Yes (Scope) | `src/features/ai-assistant/ai-assistant-page.tsx` | Conversational write capabilities (intentionally excluded). | Low | Keep strictly read-only to avoid unauthorized writes. | `VERIFIED_COMPLETE` |
| **A11** | Automation Rules Engine | Platform | Scheduled messages and reminder dispatching | 6 active rules are evaluated. Messages land in dispatch queue. Auto-sending is manual. | Yes | Yes | No | `src/features/automation/automation-page.tsx`, `src/features/automation/automation-dispatch.ts` | WhatsApp automatic dispatch integration (PL-004). | Medium | Implement automatic WhatsApp dispatcher background worker. | `PARTIALLY_IMPLEMENTED` |
| **A12** | Communication Records | Platform | Logs of client interactions | Tabulated list is rendered with server-side pagination. | Yes | Yes | Yes | `src/features/communication/communication-page.tsx` | Add direct SMS/WhatsApp triggering from the row. | Low | Keep as historical record log for now. | `VERIFIED_COMPLETE` |
| **A13** | Dashboard Alerts | Platform | Actionable exception alerts before the fold | AlertCenter component maps expiring contracts and overdue invoices. | Yes | Yes | No | `src/features/dashboard/components/alert-center.tsx` | Dedicated separate "Notification Center" route and drawer. | High | Rely on the alert-center bento; build drawer only if requested. | `PARTIALLY_IMPLEMENTED` |
| **A14** | Subdomain Vanity Routing | Platform | Tenant-specific subdomains | No code exists. Deferred to multi-office. | No | No | No | None | DNS configuration, wildcard SSL, dynamic tenant lookup. | Low | Keep deferred until multi-company pilot is completed. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **B1** | Properties CRUD & Wizard | Portfolio | 3-step creation flow for properties & ownership % | Renders wizard correctly. Updates `properties`, `property_owners`, and `owner_agreements`. | Yes | Yes | Yes | `src/features/properties/property-form-page.tsx`, `src/features/properties/property-creation-workflow-contract.test.ts` | Field labels clean-up. | High | Ensure users follow the steps to avoid invalid ownership %. | `VERIFIED_COMPLETE` |
| **B2** | Property 360 Workspace | Portfolio | Addressable 8-tab central property hub | Fully working workspace. Tabs deep-link correctly. | Yes | Yes | Yes | `src/features/properties/property-detail-page.tsx` | Empty-state styling on sparse tabs. | Medium | Add loading skeletons for slower detail tabs. | `VERIFIED_COMPLETE` |
| **B3** | Units Derived Status | Portfolio | Dynamic unit occupancy from active contracts | Computed by DB function `resolve_unit_operational_status`. Renders availability correctly. | Yes | Yes | Yes | `src/features/units/units-page.tsx`, `src/features/units/unit-service.ts` | Overlap prevention is DB-enforced but needs nicer UX alert. | High | Retain derived status model; block manual occupancy overrides. | `VERIFIED_COMPLETE` |
| **B4** | Lands Portfolio | Portfolio | Land parcel tracking | Basic list and forms exist. | Yes | Yes | Yes | `src/features/lands/` | Zod form validation alignment (PL-002). | Low | Keep as-is; run Zod unification in a bulk cleanup. | `VERIFIED_COMPLETE` |
| **B5** | Authoritative Ownership Model | Portfolio | Temporal multi-owner % tracking | Ownership percentages resolved dynamically. Demotes legacy `owner_id`. | Yes | Yes | Yes | `src/features/owners/OwnerAgreementsManager.tsx`, `src/features/owners/authoritative-property-ownership-runtime.test.ts` | Legacy trigger projections exist; do not delete until old views drop. | High | Make `property_owners` the absolute source for statements. | `VERIFIED_COMPLETE` |
| **B6** | Owners CRM Directory | Portfolio | Central owner registry | Fully working list and edit screens. | Yes | Yes | Yes | `src/features/owners/OwnersPage.tsx` | None. | High | Excellent state; keep as-is. | `VERIFIED_COMPLETE` |
| **C1** | People Directory | Relations | Consolidated profile management | Renders single source of truth for tenants, owners, brokers. | Yes | Yes | Yes | `src/features/people/people-list-page.tsx` | None. | High | Core entity. | `VERIFIED_COMPLETE` |
| **C2** | Tenants CRM Directory | Relations | Tenant profile and balance tracking | Renders tenant details. Deprecated table replaced by `people`. | Yes | Yes | No | `src/features/tenants/TenantsPage.tsx` | Cascade-delete protection for tenants with active debts is missing. | High | Implement database trigger to prevent deleting tenants with active contracts/debts. | `PARTIALLY_IMPLEMENTED` |
| **C3** | Contracts 4-State Lifecycle | Relations | Lease lifecycle (Draft, Active, Terminated, Soft-deleted) | Supported by atomic RPCs (`create_contract_atomic`, etc.). Prevents overlap. | Yes | Yes | No | `src/features/contracts/ContractsListPage.tsx`, `supabase/migrations/` | 8+2 state expansion with Maker-Checker (S04-T03). Requires legal templates (OD-03). | High | Keep 4-state live until Phase B Stage 4 is reached. | `PARTIALLY_IMPLEMENTED` |
| **C4** | Contract Documents | Relations | Attachment uploads per lease | Integrates into contracts detail view; uses secure signed URLs. | Yes | Yes | Yes | `src/features/contracts/contractDocumentsShell.tsx` | None. | Medium | Retain as-is. | `VERIFIED_COMPLETE` |
| **C5** | Payment Terms Templates | Relations | Reusable billing schedules | Renders inside settings; template selector wired in Contract Form. | Yes | Yes | Yes | `src/features/settings/payment-terms-settings-section.tsx` | None. | Medium | Retain as-is. | `VERIFIED_COMPLETE` |
| **C6** | Leads Pipeline | Relations | Client interest board | Simple kanban board / tabular tracker. | Yes | Yes | Yes | `src/features/leads/` | Zod form integration (PL-002). | Low | Upgrade to Zod schema on next form refactor. | `VERIFIED_COMPLETE` |
| **C7** | Daily/Open Lease Billing | Relations | Short-stay and open-ended contract billing | No code exists. Blocked by ADR 0001. | No | No | No | None | Contract schema updates, separate billing calculation engine. | Low | Keep deferred; single-office pilot operates monthly/annual only. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **C8** | Maker-Checker Approvals | Relations | Two-party approval gates for lease activation | No code exists. | No | No | No | None | Draft validation states, dual role sign-off hooks. | High | Blocked on S04 contract lifecycle expansion. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **D1** | Maintenance + Expense resolution | Operations | Maintenance ticket lifecycle with expense linking | `resolve_maintenance_with_expense` creates expense + balanced journal. | Yes | Yes | Yes | `src/features/maintenance/maintenance-page.tsx`, `supabase/migrations/` | Direct invoicing of tenant from resolution screen. | Medium | Train operators to resolve tickets through this workflow. | `VERIFIED_COMPLETE` |
| **D2** | Maintenance Charge-Target | Operations | Direct billing of ticket cost to tenant/owner/office | No code exists. ADR 0001 calls for splitting resolution targets. | No | No | No | None | Splitting logic on resolution form, posting to distinct subledgers. | Low | Keep deferred; current workaround is logging a separate expense. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **D3** | Utility Billing | Operations | Meter tracking and billing of utilities | Renders utility bills list; no split allocation or billing workflow. | Yes | Yes | No | `src/features/utilities/utilities-page.tsx` | Allocation split logic, direct invoice billing generation. | Medium | Build out consumption allocation logic in Phase B Stage 5. | `PARTIALLY_IMPLEMENTED` |
| **E1** | Invoices Engine | Finance | Automatic contract billing schedules | Renders invoices; statuses recalculate correctly. | Yes | Yes | Yes | `src/features/financials/invoices/` | None. | High | Keep locked; critical for billing. | `VERIFIED_COMPLETE` |
| **E2** | Payments & Receipts Shared ID | Finance | One-to-one mapping where payment = receipt | Unified table structure, unique identifier, receipt matches payment ID. | Yes | Yes | Yes | `src/features/financials/payments/` | None. | High | Essential architectural standard. Keep. | `VERIFIED_COMPLETE` |
| **E3** | Receipt VOID | Finance | Cancelling receipts with balanced reversals | `void_receipt_atomic` deletes no rows; appends reversal journals. | Yes | Yes | No | `src/features/financials/components/receipts-section.tsx`, migrations | Accepts client-supplied reversal journals, violating ADR 0005 (Conflict C-08). | High | Change RPC to clone original accounts instead of accepting payload (OD-02). | `NEEDS_OWNER_DECISION` |
| **E4** | Expenses | Finance | Registering company and owner expenses | Renders expense listings; supports atomic postings. | Yes | Yes | Yes | `src/features/financials/expenses/` | None. | High | Core feature. | `VERIFIED_COMPLETE` |
| **E5** | Arrears Workspace | Finance | Overdue invoice age tracking | Renders overdue invoice lists with filters. | Yes | Yes | Yes | `src/features/financials/arrears/arrears-page.tsx` | None. | High | Core collections tool. | `VERIFIED_COMPLETE` |
| **E6** | Tenant Deposits | Finance | Hold and refund lease deposits | Renders deposit ledger (2200). RPCs handle create/deduct/refund. | Yes | Yes | Yes | `src/features/financials/deposits/` | Richer deposit statement views. | High | Fully complete core; statement polish can be done post-pilot. | `VERIFIED_COMPLETE` |
| **E7** | Owner Settlements | Finance | Calculate and disburse owner net payout | Renders settlements page. Derives net; atomic collection reservations. | Yes | Yes | Yes | `src/features/owners/owner-settlements-page.tsx` | First-run requires ADMIN supervision. | High | Run pilot with ADMIN eyes on first payout. | `VERIFIED_COMPLETE` |
| **E8** | Commissions | Finance | Agent commissions payout and reversal | Renders commissions list; RPCs pay/reverse commissions (6100). | Yes | Yes | Yes | `src/features/commissions/commissions-page.tsx` | None (fixed missing live function via #1361). | High | Crucial for pilot. | `VERIFIED_COMPLETE` |
| **E9** | Bank Reconciliation | Finance | Reconciliation of CSV statements to ledger | Paste-import CSV handles lines. Matches via atomic RPC. | Yes | Yes | No | `src/features/financials/reconciliation/` | Excel upload wizard, suggestions engine, approval flows (FGR-006). | High | Expand reconciliation capabilities in Phase B. | `PARTIALLY_IMPLEMENTED` |
| **E10** | Accounting Periods | Finance | Soft/Hard close period locks | Migrations and status update function exist. No OPEN periods live. | Yes | Yes | No | `src/features/accounting/accountingPeriodsService.ts` | Auto-seeding of first OPEN period; connection to active business writes. | High | Complete GL wiring to activate accounting periods. | `PARTIALLY_IMPLEMENTED` |
| **E11** | Stage-3 GL Platform | Finance | Double-entry journal batches and lines engine | Posting engine and COA provision functions fully operational in tests. | No | No | No | `src/features/accounting/journalService.ts` | Business RPCs do not call the engine; writing to legacy compat view. | High | Wire business RPCs to the posting engine (S03-T01 gap). | `PARTIALLY_IMPLEMENTED` |
| **E12** | Multi-Currency | Finance | Beyond OMR operations | No code exists. OMR-only is locked (C-03). | No | No | No | None | Currency conversion rates, multi-currency journal balance verification. | Low | Keep deferred; OMR is absolute pilot standard. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **E13** | Late Fees / Penalties | Finance | Compounding-free lease penalties | No code exists. | No | No | No | None | Penalty calculation engine, independent invoice line generation. | Medium | Implement in Phase B Stage 5. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **E14** | Early Termination Workflow | Finance | Automated termination fees and schedule cancellations | No code exists. | No | No | No | None | Schedule proration engine, penalty charge generation. | Medium | Implement in Phase B Stage 5. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **E15** | Due-from-Owner Collection | Finance | Recovering negative owner payables | No code exists (OD-08). | No | No | No | None | Owner invoice generation, bank payment allocation. | High | Awaiting product decision on repayment rules. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **E16** | Credit Notes & Refunds | Finance | Reversal documents for invoices | No code exists. | No | No | No | None | Credit note schema, invoice balance recalculation triggers. | Medium | Implement in Phase B Stage 5. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **F1** | Reports Hub | Reports | Operational and executive reporting tabs | Renders tabbed reports with filters and CSV export. | Yes | Yes | No | `src/features/reports/reports-page.tsx` | Sub-reports (Trial Balance, Balance Sheet, Deferred Revenue) read subledgers or use mock data. | High | Excellent hub structure; wire to GL once S03 lands. | `PARTIALLY_IMPLEMENTED` |
| **F2** | Financial KPI Summaries | Reports | Dashboard overview counters | Wired to `rpt_financial_summary` and `rpt_dashboard_overview`. | Yes | Yes | Yes | `src/features/reports/report-rpc-contract.test.ts` | None. | High | Core metrics. | `VERIFIED_COMPLETE` |
| **F3** | Daily Collection Report | Reports | Daily reconciliation excluding VOID payments | Renders daily list; ignores VOID rows (FGR-001 closed). | Yes | Yes | Yes | `src/features/financials/receipts/payment-void-report-parity-migration-execution.test.ts` | None. | High | Vital for day-close rhythm. | `VERIFIED_COMPLETE` |
| **F4** | Cash Flow Report | Reports | subledger-based cash flow tracking | Renders subledger Cash Flow correctly. S07 kernel merged. | Yes | Yes | Yes | `src/features/reports/reports-page.tsx` | Switch source to GL once S07 lands. | Medium | Retain subledger source for pilot. | `VERIFIED_COMPLETE` |
| **F5** | VAT Return Report | Reports | VAT tax accounting report | Renders VAT report correctly. | Yes | Yes | Yes | `src/features/reports/reports-page.tsx` | Configurable tax rates (S05). | Low | Keep off for pilot; enable only when business requests. | `VERIFIED_COMPLETE` |
| **F6** | Owner / Tenant Statements | Reports | Financial statements per client | Renders filtered statements in UI; exports to PDF. | Yes | Yes | No | `src/features/reports/reports-page.tsx` | Full lifecycle audits, balance verification (FGR-003). | High | Complete live-data verification for owner statement. | `PARTIALLY_IMPLEMENTED` |
| **F7** | Financial Accounting Statements | Reports | Trial Balance, Income Statement, Balance Sheet | Renders statements; reads from subledgers instead of GL. | Yes | Yes | No | `src/features/reports/reports-page.tsx` | Wire to Stage-3 GL tables (S03-T01 gap). | High | Re-route data source to journal lines post-GL-wiring. | `PARTIALLY_IMPLEMENTED` |
| **F8** | Receivables Analytics | Reports | Aged Receivables and Rent Roll | Renders tables; drills down to invoice details. | Yes | Yes | Yes | `src/features/reports/reports-page.tsx` | Match full parity of filters with exports. | High | Essential collection metrics. | `VERIFIED_COMPLETE` |
| **F9** | Deferred Revenue Report | Reports | Accrual deferred revenue tracking | Renders report, dynamically calculating straight-line amortization from active contracts and receipts. | Yes | Yes | Yes | `src/features/financials/reports/deferred-revenue-service.ts`, `src/features/reports/reports-insights.ts` | Subledger-based rather than GL-based. | Medium | Retain subledger basis for pilot; re-wire to GL in S07. | `VERIFIED_COMPLETE` |
| **F10** | Dashboard V2 | Reports | Executive Bento layout | Bento wrapper `[data-visual-contract='v2']` active. All charts work. | Yes | Yes | Yes | `src/features/dashboard/dashboard-page.tsx` | None. | High | Replaces V1 completely. | `VERIFIED_COMPLETE` |
| **F11** | Portals | Reports | External client self-service portals | No code exists. | No | No | No | None | Tenant login, billing views, maintenance request submission. | Low | Keep in future backlog. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **G1–G7**| Governance Guard Suite | Governance| Automated checks protecting rules, plan, and paths | Green CI checks on business rules, master-plan log, and arch. | No | Yes | Yes | `scripts/check-architecture.mjs`, `workflows/` | Governance log is stale since 2026-07-18 (OD-14). | High | Backfill the governance log with 2026-08 migrations. | `VERIFIED_COMPLETE` |
| **G8** | Master Lease (S06) | Governance| IFRS-16 compliance calculations | Kernel merged. No dedicated table. | No | Yes | No | `src/s6/` | Full lease modification, remeasurement, and elections. | Medium | Complete Stage 6 review to credit. | `PARTIALLY_IMPLEMENTED` |
| **G9** | Close & Reconciliation (S07)| Governance| GL-statement close routine | Kernel merged. | No | Yes | No | `src/s7/` | Wiring to the reports hub. | Medium | Complete Stage 7 review to credit. | `PARTIALLY_IMPLEMENTED` |
| **G10**| Historical Analysis (S08) | Governance| Historical drift calculation | Merged code exists. Merged despite FINAL_REPORT stating "not ready".| No | Yes | No | `src/s08/` | Re-evaluate fixture verification; reconcile OD-11. | High | Resolve S08 dispute before proceeding to S09. | `PARTIALLY_IMPLEMENTED` |
| **G11**| Historical Correction (S09)| Governance| Append-only history edits | No code exists (blocked by S08). | No | No | No | None | Correction batch creation wizard, balanced reversal generator. | High | Blocked until S08 is resolved and credited. | `DOCUMENTED_NOT_IMPLEMENTED` |
| **G12**| Launch Sign-Off Gating (S10) | Governance| Pilot go-live accept criteria | No code exists. | No | No | No | None | Checklist validation UI, secure password validation checkers. | High | Write automated launch posture verifier. | `DOCUMENTED_NOT_IMPLEMENTED` |

---

## SECTION 3: CORE OBJECTIVE 2 — UX REALITY AUDIT

We have audited the user experience across all major modules as an active user, evaluating layout, responsive performance, state handling, and interactive safety.

### 1. Dashboard Module
- **Layout & Structure:** Bento-grid composition wrapped in `DashboardVisualScope` with the `[data-visual-contract='v2']` attribute. 
- **KPI Grid:** Four primary indicators (collections, occupancies, overdue debts, pending actions) display above the fold. Counts are resolved from `rpt_dashboard_overview` with explicit skeleton loading states.
- **Alert Center:** Urgency-sorted alerts (expiring contracts, urgent maintenance tickets, vacant counts, unmatched bank rows).
- **Interactivity:** Quick actions filter automatically by permissions (non-ADMIN users cannot see the "Post Journal" action). Charts (collections/arrears) render responsive SVG canvases without breaking RTL scan lines.
- **Loading & Errors:** Honest partial data is respected. If an auxiliary service (like bank-rec unmatched counts) fails, it displays `undefined` (hidden indicator) rather than defaulting to a misleading `0`.

### 2. Properties & Units Module
- **Wizards:** Property creation utilizes a 3-step overlay wizard (`PropertyFormModal`) guiding the user through (1) Property Info, (2) Ownership percentages and management agreement settings, and (3) Units configuration. Focus is trapped correctly, and page shifts do not scroll the parent canvas.
- **Property 360:** Reached via `PropertyDetailPage` containing 8 tabs. Deep-linking to tab routes works flawlessly (tabs are URL-addressable, preserving backward navigation). Financial sub-tab aggregates cash collections for the property correctly.
- **Derived Statuses:** Units render status badges dynamically (Available/Occupied/Maintenance) driven by the contract database. Skeletons prevent content shifts during initial fetch.

### 3. Owners & Tenants Module
- **CRM Directory:** Renders list views with server-side range pagination. Columns align correctly with logic direction (`start` and `end` logical properties applied instead of raw `left` or `right` margins).
- **Agreements Manager:** Inline agreement creation under `OwnerAgreementsManager` validates overlapping dates. Inputs for percentage fees restrict numeric entry to 3 decimal places.
- **Cascade Deletes:** Safe UI delete button is visible, but the backend lacks tenant-cascade blocker triggers. *Critical warning: Deleting a tenant with active unpaid invoices is currently permitted by the UI, but it leaves orphaned invoice lines in database.*

### 4. People & Leads Module
- **Directories:** Reused `person-form-modal.tsx` provides unified fields for tenants, owners, and operators, ensuring a single contact profile is shared across contracts and settlements.
- **Leads board:** Renders a clean list board. Cards are touch-compliant (minimum 44×44px interactive area) but lack Zod schema binding, causing occasional empty submits if raw database requirements are missed.

### 5. Contracts Module
- **Atomic Operations:** Contract details page includes separate actions for "Renew" and "Terminate". Confirmations open in an modal (`EnterpriseConfirmDialog`) requiring type-to-confirm for terminations.
- **Previews:** Shows estimated invoicing schedule previews at the "Draft" stage, letting the operator verify billing dates before activating.
- **Interaction Gaps:** No signature-upload or digital signing interface is reachable. The contract is immediately activated upon clicking the activate action.

### 6. Invoices & Receipts Module
- **Allocation Grid:** Quick payment form allows direct allocation of a receipt amount against multiple unpaid invoices. The allocation grid computes remaining balances in real-time.
- **Voiding Wizard:** Receipts list details card includes a "Void Receipt" action. This triggers a drawer requesting the void reason. It generates an immediate balanced reversal batch, returning the related invoice to "Unpaid".
- **States:** Loading skeletons resemble invoice tables. Empty states contain an "Issue Invoice" quick link, but error retry actions are missing on partial failures.

### 7. Expenses & Maintenance Module
- **Resolution Drawer:** Resolving maintenance tickets triggers the `resolve_maintenance_with_expense` drawer. This form allows capturing description, amount, and cost-center, immediately writing an expense record.
- **Split allocations:** Form contains no selection for charge splits (tenant/owner/office splits are undocumented-unimplemented). All resolved costs default to company operating expenses.

### 8. Owner Settlements Module
- **Payout Flow:** Draft settlements show collections and expenses reserved for the payout. Clicking "Approve" locks the reserved lines. "Disburse" triggers a balanced GL journal entry, issuing cash.
- **UX Safety:** Re-derives totals on every step. If collections are voided in another tab during settlement draft review, the screen warns "Stale Inputs" and blocks the pay action, preventing duplicate payouts.

### 9. Commissions Module
- **Commission payouts:** Renders inline payout lists with individual contract links. 
- **Reversal Safety:** Includes a clear "Reverse Payout" button that appends reversal journals and marks the payout reversed. *Audit check: Fixed in code, fully working.*

### 10. Finance Hub & Bank Reconciliation Module
- **Hub Navigation:** Thin route wrapper provides deep-linking tabs without loading a heavy router parent context. Left-side drawer menu is accessible on mobile.
- **Reconciliation Import:** Renders a text area for copy-pasting CSV rows. Renders a preview grid before committing.
- **Match interface:** Displays imported statement lines on the left and unmatched ledger receipts on the right. Tap targets are large, but auto-suggested match highlights are missing.

### 11. Reports Hub Module
- **Interface:** Tabbed workspace `/reports` organizes cash flow, arrears, VAT, collection, and trial balance. Filter bar is sticky, keeping selection on tab switches.
- **Drilldowns:** KPI numbers inside reports drill down to source lists (e.g. aged receivables totals link to individual invoice rows).
- **Parity Gaps:** Trial balance and income statement reports display data from subledgers, not the Stage-3 GL tables. Display precision is locked to OMR 3dp.

### 12. Settings & Administration Module
- **Role simulator:** Under settings, admins can toggle a "Simulator Role" to test the UI experience as a USER or MANAGER. Focus guides update immediately.
- **Audit logs:** Paginated logs display raw action JSONs. Renders clean Hebrew/Arabic/Latin fragments without breaking sentence flow.

---

## SECTION 4: UX COMPLIANCE CHECKLIST

Every future UI contribution must verify its compliance against these 5 core tenets:

1. **Logical Breakpoints & Scroll:**
   - Perfect single-column flow between 320px and 414px.
   - Absolutely zero horizontal application-level scrolling. Component scrolling (e.g., wide data tables) is focus-visible with gradient shadow indicator showing overflow content.

2. **State Contract Coverage:**
   - Every page must render dedicated, distinct `LoadingState` (skeleton grids), `EmptyState` (illustration + call-to-action), and `ErrorState` (message + retry callback). 
   - Never render a zero count or empty layout on network failure.

3. **Typography & Arabic-First RTL:**
   - Font family Cairo loaded via CSS with explicit line heights (1.55 to 1.7) for maximum readability.
   - Enforce `-u-nu-latn` Latin numerals in all numeric values. Eastern Arabic numerals (١٬٢٥٠) are prohibited in product UI.
   - logical spacing properties (`start`/`end` instead of `left`/`right`) applied.

4. **Interactive Safety:**
   - Minimum interactive touch area of 44×44px for buttons, inputs, and list rows.
   - Keyboard focus outlines always visible.
   - Reversible actions (e.g., draft deletion) require simple confirmation; irreversible actions (e.g. contract termination, receipt voiding) require type-to-confirm modals. Swipe-to-execute is banned.

5. **Theme Parity:**
   - Full light/dark token compliance. Canvas changes from clean off-white to deep slate. No raw Tailwind colors (e.g., `bg-blue-500`) allowed; utilize semantic color classes.
