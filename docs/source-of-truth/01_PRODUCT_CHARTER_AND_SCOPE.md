# MALEK Canonical Pack — Document 1: Product Charter and Scope

> **Status:** CANONICAL  
> **Rule ID Prefix:** PRD-###  
> **Effective Date:** 2026-08-10

---

## 1. Target Customer and Operator

**PRD-001 — Target Customer**

MALEK serves small-to-medium property management offices operating in the Sultanate of Oman. Target customers manage residential, commercial, or mixed-use portfolios with 5–500 units across 1–20 properties.

**PRD-002 — Target Operator**

The primary operator is an Arabic-speaking office administrator or accountant with basic accounting knowledge. English-language support is secondary.

**PRD-003 — Operator Environment**

- Single-office pilot phase (multi-office deferred)
- Omani Rial (OMR) currency only
- Arabic-first, RTL-primary interface
- Desktop and mobile web browser access (PWA)

---

## 2. Core Customer Problems

**PRD-010 — Problem Statement**

Property management offices in Oman face:
- Fragmented tracking of multiple owners, agreements, and payment schedules
- Manual rent collection tracking prone to error and disputes
- Unclear owner fund accountability and settlement timing
- Difficulty reconciling bank statements with tenant receipts
- Compliance risk from lack of audit trails and period controls

**PRD-011 — Value Proposition**

MALEK provides a unified Arabic-first platform that:
- Centralizes property, unit, owner, and tenant data
- Automates rent invoicing and payment tracking
- Ensures transparent owner fund segregation and settlement
- Supports bank reconciliation and period-close controls
- Maintains immutable financial audit trails

---

## 3. Primary Capabilities

**PRD-020 — Property and Unit Management**

- Property creation, editing, archiving
- Unit provisioning with rent amounts and status tracking
- Property ownership links with temporal validity

**PRD-021 — People and Contact Management**

- Owner, tenant, and contact person records
- People are canonical; separate `tenants` table is deprecated
- Soft archive capability

**PRD-022 — Owner Agreements**

- Versioned owner agreements per property
- Support for property management (OWNER_AGENCY) and master lease operating models
- Commission rate and fixed-fee tracking
- Temporal validity enforcement

**PRD-023 — Contract Lifecycle**

- Draft → active/expired/terminated contract states (4-state)
- Contract creation, editing, renewal, termination
- Maker-Checker approval (planned but not fully implemented)
- Signature evidence requirements (planned)

**PRD-024 — Financial Operations**

- Invoice generation and tracking
- Receipt recording and allocation
- Void and reversal support
- Owner settlement with atomic reservation
- Commission payment tracking

**PRD-025 — Operational Expenses**

- Owner, office, and tenant-recoverable expense categories
- Expense recording with property/unit assignment
- Due-from-owner tracking

**PRD-026 — Tenant Deposits**

- Deposit receipt, application, and refund
- Liability treatment (never revenue)
- Atomic deposit transactions

**PRD-027 — Bank Reconciliation**

- CSV import with fail-closed validation
- Duplicate detection
- Match/ignore workflow
- Reconciliation status tracking

**PRD-028 — Reporting**

- Operational reports (collections, arrears, rent roll)
- Financial reports (trial balance, income statement, balance sheet)
- GL read-only access
- Owner and tenant statements

**PRD-029 — Maintenance Tracking**

- Maintenance request recording
- Service provider assignment
- Expense resolution integration

---

## 4. Product Boundaries

**PRD-030 — Explicit Non-Goals**

The following are explicitly out of scope for the release:

| Exclusion | Rationale |
|-----------|-----------|
| CRM features beyond contact management | Generic CRM is a separate product category |
| Land sales tracking | Land management is unrelated to rental operations |
| Investment portfolio management | Outside property management scope |
| Generic ERP features | Not aligned with target customer needs |
| Multi-currency support | Pilot is OMR-only |
| Multi-office/tenant SaaS | Single-office pilot phase |
| Subdomain-based routing | Deferred to multi-office phase |
| Jurisdiction-specific legal templates | Requires external legal review |

**PRD-031 — OFFICE_OWNED Model**

The office-owned operating model is supported in principle but is not the primary target. OFFICE_OWNED allows skipping the owner-agreement step while maintaining all other property management workflows.

**PRD-032 — Master Lease Scope**

Master lease is a separate principal model, not a variant of owner-agency. It requires:
- Independent head-lease contracts
- ROU asset and lease liability accounting
- Separate vacancy risk treatment
- **NOT** confused with owner-agency collection settlements

---

## 5. Supported Operating Models

**PRD-040 — OWNER_AGENCY (Primary)**

- Office acts as agent
- Net presentation to owner
- `OWNER_IS_CREDITOR` collection model
- Rent recorded in tenant subledger, not office GL as revenue

**PRD-041 — MASTER_LEASE**

- Office acts as principal
- Gross presentation
- `OFFICE_IS_CREDITOR` collection model
- Office recognizes rental revenue
- Separate accounting module with ROU asset and lease liability
- **NOT** merged with owner settlement accounts

**PRD-042 — OFFICE_OWNED**

- Office owns the property
- Full revenue recognition
- No owner-agreement step required
- All other workflows apply

**PRD-043 — BROKERAGE_OR_COLLECTION_ONLY**

- Office acts as agent
- Revenue is net of commissions
- `collection_role` explicitly defined per agreement

---

## 6. Supported Jurisdictions and Currency

**PRD-050 — Jurisdiction**

 Sultanate of Oman only for pilot phase.

**PRD-051 — Currency**

 Omani Rial (OMR) with **exactly 3 decimal places** (e.g., `1,250.500`).

- Bank-standard rounding (`round(value, 3)`) performed **server-side only**
- Frontend never performs rounding for ledger insertion
- Currency tag: `ر.ع.`

**PRD-052 — VAT Treatment**

- No hard-coded statutory rate in code
- Company-level tax profile with versioned tax codes
- Each line item snapshots tax code, rate, basis, amount
- VAT Payable account: **2100**

---

## 7. Release Scope vs. Future Scope

**PRD-060 — Release Scope (Pilot)**

The following are within release scope:

| Area | Scope Items |
|------|-------------|
| Core PM | Properties, units, people, owners, tenants, agreements, contracts |
| Financial Core | Invoices, receipts, voids, expenses, deposits, owner settlements |
| GL Foundation | Chart of accounts, journal batches, periods, basic posting |
| Reporting | Operational KPIs, tenant/owner statements, basic GL view |
| Security | Company isolation, RLS, RPC-only financial writes, permission model |
| Reconciliation | CSV import, match workflow (approval flow planned) |
| Maintenance | Request tracking, service provider integration |

**PRD-061 — Future Scope (Post-Pilot)**

The following are explicitly deferred:

| Area | Deferred Items |
|------|----------------|
| Master Lease Full IFRS | ROU/liability schedules, remeasurement, depreciation schedules |
| Advanced Reporting | Full financial statements, cash flow, reconciliation dashboard |
| Historical Correction | S08/S09 analysis and append-only correction batches |
| Maker-Checker Final | Full workflow implementation, signature verification |
| Advanced VAT | Multi-rate support, filing workflows |
| Late Fees | Compound penalty support, grace period automation |
| Credit Notes | Full credit note lifecycle |
| Multi-Office | Subdomain routing, cross-company reporting |
| Document Generation | PDF contract templates with legal wording |

---

## 8. Meaning of "Production Ready"

**PRD-070 — Production Ready Criteria**

For MALEK, "production ready" means:

1. **Company Isolation Verified** — No cross-company data leakage; RLS enforced on all tables
2. **Financial Integrity** — GL posting and reversal verified; GL/subledger reconciliation passes
3. **Permissions Verified** — All permission gates functional; Maker-Checker separation enforced
4. **Main CI Green** — All CI checks pass on latest main
5. **Mobile/Desktop/RTL Accepted** — All viewports verified acceptable
6. **Printable Documents Accepted** — PDF output verified for receipts and settlements
7. **Pilot Data Cycle Complete** — One full accounting period completed with reconciliation
8. **Release Candidate Approved** — Explicit approval from product owner
9. **One-Office Pilot Completed** — Live operation with real data
10. **Production Launch Decision** — Explicit go/no-go decision recorded

**PRD-071 — Not Production Ready Indicators**

The following do **not** constitute production readiness:

- Component tests passing
- PR merged to main
- UI looks correct in development
- Single happy-path scenario works
- Documentation claims completion

---

## 9. Brand and Naming

**PRD-080 — Product Name**

The visible product name is **MALEK** (مالك).

**PRD-081 — Technical Identifiers**

The following remain unchanged for backwards compatibility:
- Repository name: `malik`
- Package path: `rentrix-app/`
- Database schema: `malik`
- Infrastructure identifiers

**PRD-082 — Deprecated Names**

The following are deprecated:
- "MALIK" as visible English text → use "MALEK"
- "Rentrix" as visible branding → use "MALEK"
- Legacy raster icons → use MALEK asset contract

---

## 10. Implementation Status Summary

| Capability | Status | Evidence |
|------------|--------|----------|
| Property/Unit Management | VERIFIED_COMPLETE | Core CRUD operations, tests |
| People/Owner/Tenant | VERIFIED_COMPLETE | People-first architecture, tests |
| Owner Agreements | IMPLEMENTED_UNVERIFIED | RPCs exist; Maker-Checker pending |
| Contract Lifecycle | PARTIAL | 4-state implemented; Maker-Checker pending |
| Invoice/Receipt/Void | IMPLEMENTED_UNVERIFIED | GL wiring in progress |
| Owner Settlements | PARTIAL | Reservation system exists; Due-from-Owner recovery pending |
| Expenses | PARTIAL | Basic forms exist; split billing unwritten |
| Deposits | IMPLEMENTED_UNVERIFIED | Schema and services exist |
| Bank Reconciliation | PARTIAL | Import wired; approval flow pending |
| GL Engine | PARTIAL | Schema merged; business posting not wired |
| Reports | PARTIAL | Operational reports exist; GL statements need wiring |
| Master Lease | NOT_STARTED | Schema kernel merged; modifier modules unwritten |
| Historical Correction | NOT_STARTED | Analysis S08 blocked; S09 not started |

---

## Cross-References

- **ADR 0011:** Final business, accounting, and operating policies (governs D01-D18)
- **Decision Register:** `governance/final-decision-register.json`
- **Execution Plan:** `governance/10-stage-master-plan.json`
- **Arabic Constitution:** `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
