# MALEK — Technical Architecture & Roadmap (Document 3)

> **Execution-Ready Source of Truth.** Created on 2026-08-07. This document represents the definitive guide on the system's technical architecture, multi-tenant security layers, open decisions, and the phased 10-stage execution plan.

---

## SECTION 1: SYSTEM ARCHITECTURE

MALEK is built as an enterprise-grade multi-tenant SaaS application leveraging a secure PostgreSQL backend and a responsive, high-performance web frontend.

### 1. Repository Layout
- **Frontend App:** `/rentrix-app` (Vite, React 19, TypeScript, Tailwind v4).
- **Database Migrations:** `/supabase/migrations` (189 incremental migrations).
- **Database Rollbacks:** `/supabase/rollback` (32 rollback files).
- **Engineering Workflows:** `.github/workflows` (CI, database preflights, rule guards).

### 2. Multi-Tenant SaaS Isolation
The application implements strict row-level security (RLS) to isolate tenant data.
- **Company Bounds:** Every operational table contains a `company_id` column.
- **Dynamic Resolution:** The database function `current_company_id()` extracts the user's active company ID directly from their Supabase Auth JWT claims (`app_metadata.company_id`).
- **RLS Isolation Enforcer:**
  ```sql
  CREATE POLICY tenant_isolation_policy ON properties
  AS RESTRICTIVE USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());
  ```
- **Performance Advisories:** 224 open advisories exist (including `auth_rls_initplan` and `multiple_permissive_policies`) which are logged for future query optimization.

### 3. Financial Write Trust Model
The client browser is treated as untrusted for all financial mutations.
- **Atomic RPCs:** Modifying financial data (invoices, receipts, voids, settlements, commissions) via direct client table INSERTs or UPDATEs is completely blocked by RLS.
- **Security Definer Wrappers:** All mutations must flow through transactional Postgres functions declared as `SECURITY DEFINER` with fixed, locked `search_path` attributes.
- **Idempotency Guard:** Every write RPC accepts a `request_id` and a unique payload fingerprint, matching against the `financial_operation_idempotency` table before writing. Duplicate submissions reject with custom exception codes (e.g., `22023`).

### 4. Dependency Boundary (Guard v2)
The frontend implements an automated architectural boundary check via `scripts/check-architecture.mjs` on every commit.
- **Rule:** Presentation components are blocked from directly importing cross-feature services.
- **Seams:** New features must declare their inter-feature dependency maps explicitly in the config allowlist.

---

## SECTION 2: 10-STAGE ROADMAP & EXECUTION STATUS

The platform's features are rolled out according to a 10-stage plan managed via `governance/10-stage-master-plan.json`. Below is the true git-verified status of each stage as of August 2026:

### Stage S01: Foundation & Governance
- **Scope:** Repository structuring, database baseline, and Arabic-first business rule guards.
- **Git Status:** Merged (#1344, #1345).
- **True Status:** `VERIFIED_COMPLETE` (Reviewed and credited).

### Stage S02: Multi-Tenant Hardening & CSV Imports
- **Scope:** JWT-based tenant isolation and fail-closed bank CSV import engine.
- **Git Status:** Merged (#1350, #1361). Commission RPCs fixed live.
- **True Status:** `MERGED` (Pending reviewer sign-off).

### Stage S03: General Ledger Core
- **Scope:** Chart of Accounts, journal batches, lines, and accounting periods.
- **Git Status:** Engine and schema migrated, but no business RPCs are wired to post to GL.
- **True Status:** `ENGINE_SHIPPED_NOT_WIRED` (Partial).

### Stage S04: Third-Party Property Management
- **Scope:** Versioned owner agreements, Maker-Checker contract approvals, and signature verification.
- **Git Status:** No code written. Legacy 4-state contract lifecycles exist.
- **True Status:** `NOT_STARTED` (Intentionally deferred).

### Stage S05: Operational Accounting Polish
- **Scope:** Utility splits, maintenance charge resolution, late fees, and credit notes.
- **Git Status:** Basic forms exist, but unified split billing is unwritten.
- **True Status:** `PARTIALLY_IMPLEMENTED`.

### Stage S06: Master Lease (IFRS-16)
- **Scope:** Lease liability and Right-of-Use asset calculations.
- **Git Status:** Schema kernel merged (#1362). Full modifier modules open.
- **True Status:** `KERNEL_MERGED` (Pending review).

### Stage S07: Reporting & Reconciliation
- **Scope:** Multi-company cash flow analytics.
- **Git Status:** Kernel merged (#1363). Reports still query subledgers.
- **True Status:** `KERNEL_MERGED` (Pending review).

### Stage S08: Historical Analysis
- **Scope:** Legacy data reconciliation.
- **Git Status:** Merged (`8e4908a7`), but internal documentation notes it is not ready for review.
- **True Status:** `NEEDS_OWNER_DECISION` (Contested).

### Stage S09: Historical Correction
- **Scope:** Append-only database ledger correction batches.
- **Git Status:** No code written. Blocked on S08 credit.
- **True Status:** `NOT_STARTED` (Deferred).

### Stage S10: Pilot Launch
- **Scope:** Real-account handover, validation gates, and final pilot sign-off.
- **Git Status:** Deployment and tests green. GO conditions remain open.
- **True Status:** `NOT_STARTED` (Checklist open).

---

## SECTION 3: OPEN DECISIONS (OD-01 to OD-19)

### OD-01 — Banner Supersession for ADR 0004 (Conflict C-02)
- **Context:** ADR 0004 specifies a "FULL_MONTH" billing default. ADR 0011 decrees a "DAILY" accrued basis.
- **Options:** (a) Add a banner to ADR 0004 stating "Superseded by ADR 0011" (Recommended); (b) Archive ADR 0004.
- **Consequence:** Eliminates proration math ambiguity for future developers.

### OD-02 — Void Signature Payload (Conflict C-08)
- **Context:** ADR 0005 states voids must clone original account IDs. Code accepts custom `p_reverse_entries` payload.
- **Options:** (a) Keep code payload flexible (Wider risk surface); (b) Refactor RPC to clone original entries (Recommended).

### OD-03 — Missing Legal Templates
- **Context:** Production contracts cannot be generated without signed legal templates in evidence.
- **Requirement:** Gather and upload the official PMC, Tenant Lease, Master Lease, and Offset clauses.

### OD-04 — Role Model Scope (Conflict C-05)
- **Context:** Code implements 3 app roles. ADR 0003 describes 6 roles.
- **Options:** (a) Expand permission tables to 6 roles (Accountant/Viewer next); (b) Keep 3 roles (Simplest for pilot).

### OD-05 — Multi-Currency Strategy (Conflict C-03)
- **Context:** Schema has currency columns but the pilot is OMR-only. 
- **Recommendation:** Confirm OMR-only lock for the single-office pilot phase.

### OD-06 — Brand Standardization (Conflict C-01)
- **Recommendation:** Confirm MALEK as visible standard, while keeping legacy `malik` technical paths for stability. Delete outdated MALIK brand files.

### OD-07 — Numeral Display Standard (Conflict C-06)
- **Recommendation:** Permanently adopt Latin numbers (`-u-nu-latn`) across all financial sheets, archiving the Eastern Arabic spec.

### OD-08 — Due-From-Owner collections
- **Context:** Owner payables can never go negative. When owner expenses exceed collections, a recovery mechanism is needed.
- **Options:** (a) Offset from future rent collections; (b) Generate a payment invoice to the owner.

### OD-09 — Chart of Accounts Numbers (Conflict C-04)
- **Recommendation:** Seal implemented account numbers (2000, 2200, 6100) as canonical, updating old architectural concept docs to historical.

### OD-10 — DOMAIN.md Deposit correction (Conflict C-09)
- **Recommendation:** Correct `DOMAIN.md` to show that deposits are fully modeled and supported in the code.

### OD-11 — S08 Crediting Dispute
- **Context:** Stage 8 merged but internal files marked it as not ready.
- **Action:** Re-verify Stage 8 outputs before allowing Stage 9 (Historical Correction) to begin.

### OD-12 — Cairo Font Self-Hosting
- **Action:** Self-host Cairo font inside the public folder to ensure offline PWA capabilities.

### OD-13 — Stale Branch Cleanup
- **Action:** Execute bulk deletion of 250+ stale remote branches from the repository.

### OD-14 — Governance Log Backfill
- **Action:** Backfill `GOVERNANCE_LOG.md` with 2026-08 migrations, establishing strict git hooks to prevent unlogged database changes.

### OD-15 — Repository-Only Migrations Cleanup
- **Context:** 14 migrations exist in the repo but were never applied live.
- **Action:** Remove the 14 unapplied repo-only migrations to align local schema with production.

### OD-16 — Archive Retention policy
- **Recommendation:** Keep completed-phase audits as evidence history; delete stale point-in-time test logs.

### OD-17 — Sonar Exclusions properties
- **Action:** Clean up duplicate exclusion lines in `sonar-project.properties`.

### OD-18 — Subdomain routing Deferral
- **Recommendation:** Keep subdomain-per-company tenant routing deferred to the multi-office phase.

### OD-19 — Stage Ledger Markings
- **Action:** Establish a clear reviewer-led process to check off merged stages in the master plan checklists.

---

## SECTION 4: UNRESOLVED DOCUMENT CONFLICTS

### C-01: visible English name
- **Reality:** Title, manifest, and logos are **MALEK**. Old documentation refers to MALIK. Resolved by ADR 0011.

### C-02: Proration defaults
- **Reality:** Fixed monthly fee accrues **daily**. Old decisions allowed full-month billing. Resolved by ADR 0011.

### C-03: Currency
- **Reality:** Locked to **OMR**. Legacy documents mention EGP. Resolved by ADR 0011.

### C-04: Chart of accounts numbers
- **Reality:** Deposits = 2200, Settlements = 2000, Expenses = 6100. Concept docs proposed 2301/2201. Resolved by Stage-3 migrations.

### C-05: Roles count
- **Reality:** Code implements 3 roles. Documents specify 6. Awaiting OD-04.

### C-06: Numerals display
- **Reality:** Latin digits display by force. Old specs requested Eastern Arabic. Resolved by code formatting.

### C-07: Contract States
- **Reality:** 4 states live in code. 8+2 target in docs. Resolved as expected implementation gap.

### C-08: Reversals source accounts
- **Reality:** `void_receipt_atomic` takes custom payload. ADR 0005 requires cloning original entries. Awaiting OD-02.

### C-09: Deposits modeling
- **Reality:** Deposits are fully modeled in database and services. Old domain docs state they are not modeled. Resolved by code.

---

## SECTION 5: DISPOSITION OF LEGACY DOCUMENTS

To streamline onboarding for future agents and maintain an execution-ready codebase, the legacy, redundant, or superseded documentation files have been consolidated or marked for cleanup:

### 1. Merged & Consolidated (Safe to Delete)
The following files have their contents fully captured in Documents 1, 2, and 3:
- `docs/source-of-truth/00_Executive_Summary.md` → Consolidated in Document 1.
- `docs/source-of-truth/01_Documentation_Inventory.md` → Replaced by Section 5 here.
- `docs/source-of-truth/02_Product_Vision.md` → Replaced by Document 1 & 3.
- `docs/source-of-truth/03_Business_Rules.md` → Captured in Document 2.
- `docs/source-of-truth/04_Accounting.md` → Captured in Document 2.
- `docs/source-of-truth/05_Legal_Workflows.md` → Captured in Document 2.
- `docs/source-of-truth/06_Architecture.md` → Captured in Document 3.
- `docs/source-of-truth/07_UX_Bible.md` → Captured in Document 1.
- `docs/source-of-truth/08_Brand_Design.md` → Captured in Document 2.
- `docs/source-of-truth/09_Feature_Catalog.md` → Captured in Document 1.
- `docs/source-of-truth/10_Roadmap.md` → Captured in Document 3.
- `docs/source-of-truth/11_Current_Status.md` → Captured in Document 1.
- `docs/source-of-truth/12_Open_Decisions.md` → Captured in Document 3.
- `docs/source-of-truth/13_Conflict_Report.md` → Captured in Document 3.
- `docs/source-of-truth/14_Deletion_Proposal.md` → Consolidated here.

### 2. Maintenance Protocol for the 3 Master Documents
Future agents modifying the codebase must follow these 3 strict rules:
1. **No new scattered files:** When shipping a feature or resolving a decision, update the exact owning document among the three master files. Do not create new documents in the repo.
2. **Synchronized Updates:** When a state changes (e.g., S02 is credited or OD-02 is resolved), update both the Feature Reality Catalog (Doc 1) and the Technical Architecture (Doc 3) in the same PR.
3. **Arabic Constitution is Paramount:** No English document update can override the locked Arabic business rules constitution. Changes to core rules require an ADR and a SHA-256 hash bump.
