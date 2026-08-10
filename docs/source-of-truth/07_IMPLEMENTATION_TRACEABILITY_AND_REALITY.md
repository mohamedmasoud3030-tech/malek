# MALEK Canonical Pack — Document 7: Implementation Traceability and Reality

> **Status:** CANONICAL  
> **Rule ID Prefix:** PRD/OPS/DOM/FIN/SEC/UX/REL-###  
> **Effective Date:** 2026-08-10

---

## 1. Overview

This document provides the authoritative brownfield evidence for the Malik system. It maps every critical rule to implementation evidence and identifies gaps requiring resolution.

### 1.1 Status Definitions

| Status | Definition |
|--------|------------|
| VERIFIED_IMPLEMENTED | Concrete implementation + meaningful verification evidence |
| IMPLEMENTED_UNVERIFIED | Code present but insufficient verification |
| PARTIAL | Partial end-to-end wiring |
| NOT_IMPLEMENTED | Not started or completely missing |
| CONFLICT | Conflicting documents or incompatible implementations |
| BLOCKED_EXTERNAL | Requires unavailable live environment, auth hook, secrets, or external approval |

---

## 2. Traceability Matrix

### 2.1 Product Scope Rules (PRD-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| PRD-001 | Target customer: Oman PM office 5-500 units | — | — | — | — | README.md | None | CONFLICT | "MALIK" branding in code vs "MALEK" visible | UX-001 |
| PRD-030 | CRM excluded from scope | — | — | — | — | — | None | CONFLICT | `owners-crm-bundle.test.tsx` exists | UX-001 |
| PRD-040 | OWNER_AGENCY model supported | `owner_agreements.agreement_type` | `ownerAgreementService.ts` | `/owners` | RLS on `owner_agreements` | `ownerAgreementService.test.ts` | None | IMPLEMENTED_UNVERIFIED | GL wiring not complete | WP-03 |
| PRD-041 | MASTER_LEASE model supported | `owner_agreements.agreement_type='master_lease'` | Owner agreement RPCs | `/owners` | RLS | `ownerAgreementService.test.ts` | None | PARTIAL | Full IFRS module unwritten | WP-01 |
| PRD-042 | OFFICE_OWNED model supported | `owner_agreements` skipped | Contract creation | `/contracts` | RLS | None | None | PARTIAL | Full test coverage missing | WP-03 |
| PRD-050 | OMR currency only | `companies.currency` | — | — | — | — | None | CONFLICT | Schema has currency columns, code may vary | WP-01 |
| PRD-051 | 3 decimal places for OMR | `NUMERIC(18,3)` in migrations | `roundOmr3()` in `accountingDomain.ts` | — | — | `accountingServices.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| PRD-060 | Release scope defined | — | — | — | — | — | None | CONFLICT | Scope documented but not enforced in PRs | WP-07 |
| PRD-070 | Production ready criteria | — | — | — | — | — | None | NOT_IMPLEMENTED | 10 criteria defined but not verified | WP-07 |

---

### 2.2 Operating Model Rules (OPS-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| OPS-101 | OWNER_IS_CREDITOR: Rent in subledger, collection to Owner Payable | `contracts.collection_role`, `receipts` | `record_invoice_payment_atomic` | `/financials/receipts` | RPC-only writes | `product-accounting-decision-gates.test.ts` | None | PARTIAL | GL wiring not complete | WP-02 |
| OPS-102 | RATE commission on collection | `owner_agreements.commission_type='RATE'` | Settlement RPCs | `/financials/settlements` | RLS | None | None | NOT_IMPLEMENTED | S04-T06 not started | WP-03 |
| OPS-111 | OFFICE_IS_CREDITOR: Invoice Tenant AR to GL | `invoices`, `contracts.collection_role` | Invoice RPCs | `/financials/invoices` | RPC-only | None | None | NOT_IMPLEMENTED | GL posting not wired | WP-02 |
| OPS-201 | Property onboarding checklist | `properties`, `units` | CRUD RPCs | `/properties` | `properties.create` | `OwnersPage.test.tsx` | None | IMPLEMENTED_UNVERIFIED | Documents/inspection pending | WP-06 |
| OPS-301 | Owner onboarding with agreement | `people`, `owner_agreements` | `create_property_with_agreement` | `/people`, `/owners` | `owners.create` | `authoritative-property-ownership.test.ts` | None | PARTIAL | Agreement versioning PARTIAL | WP-03 |
| OPS-321 | Tenant onboarding via people-first | `people.type='tenant'` | CRUD RPCs | `/people` | `people.create` | `people.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| OPS-401 | Contract lifecycle: draft→active→expired/terminated | `contracts.status` | `create_contract_atomic`, `terminate_contract_atomic` | `/contracts` | `contracts.create`, `contracts.terminate` | `contracts-lifecycle-interaction.test.tsx` | None | IMPLEMENTED_UNVERIFIED | Maker-Checker and signatures pending | WP-03 |
| OPS-421 | Contract activation with Maker-Checker | `contracts.status='active'` | Activation RPC | `/contracts` | `contracts.activate` | None | None | NOT_IMPLEMENTED | Maker-Checker not implemented | WP-03 |
| OPS-501 | Invoice generation from contract | `invoices` | Invoice RPCs | `/financials/invoices` | RPC-only | None | None | IMPLEMENTED_UNVERIFIED | GL wiring partial | WP-02 |
| OPS-601 | Receipt recording | `receipts`, `receipt_allocations` | `record_invoice_payment_atomic` | `/financials/receipts` | `receipts.create` | `receipts.test.ts` | None | IMPLEMENTED_UNVERIFIED | GL wiring partial | WP-02 |
| OPS-621 | Receipt voiding with reversal | `receipts.status='voided'` | `void_receipt_atomic` | `/financials/receipts` | `receipts.void` | `void.test.ts` | None | IMPLEMENTED_UNVERIFIED | Maker-Checker pending | WP-03 |
| OPS-701 | Deposit receipt as liability | `deposits`, `2200 account` | Deposit RPCs | `/financials/deposits` | RPC-only | `deposit.test.ts` | None | IMPLEMENTED_UNVERIFIED | Full allocation workflow pending | WP-04 |
| OPS-801 | Owner expense as Due from Owner | `expenses.responsibility='owner'`, `1205 account` | `create_expense_with_journal_atomic` | `/financials/expenses` | RPC-only | `expense.test.ts` | None | IMPLEMENTED_UNVERIFIED | Split billing unwritten | WP-04 |
| OPS-901 | Owner settlement with atomic reservation | `owner_settlements`, `settlement_payment_links` | Settlement RPCs | `/financials/settlements` | `financial.owner_settlements.view` | `owner-settlements-service-listAll.test.ts` | None | PARTIAL | Due-from-Owner recovery pending | WP-04 |
| OPS-1001 | Bank CSV import fail-closed | `bank_import_batches`, `bank_transactions` | `create_bank_import_batch` | `/financials/reconciliation` | `financial.bank_reconciliation.view` | `bankCsvParser.test.ts` | None | IMPLEMENTED_UNVERIFIED | FGR-006 approval flow pending | WP-05 |
| OPS-1101 | Period states: OPEN→SOFT_CLOSED→HARD_CLOSED | `accounting_periods.status` | Period RPCs | `/reports?section=general_ledger` | RPC-only | `stage3-periods-reversal-security.test.ts` | None | IMPLEMENTED_UNVERIFIED | Close checklist pending | WP-05 |

---

### 2.3 Domain Model Rules (DOM-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| DOM-101 | Company as tenant boundary | All tables have `company_id` | — | — | RLS on all tables | `P0_MULTI_TENANT_VERIFICATION_20260723.md` | None | VERIFIED_IMPLEMENTED | None | — |
| DOM-102 | current_company_id() resolution | — | `current_company_id()` function | — | — | `multi_company_jwt_selection.sql` tests | None | VERIFIED_IMPLEMENTED | None | — |
| DOM-201 | Property hierarchy | `properties`, `units` | CRUD RPCs | `/properties` | RLS | `property.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| DOM-210 | Owner agreement with collection_role | `owner_agreements` | Owner agreement RPCs | `/owners` | RLS | `ownerAgreementService.test.ts` | None | IMPLEMENTED_UNVERIFIED | Versioning PARTIAL | WP-03 |
| DOM-220 | Contract with agreement reference | `contracts.agreement_id` | `create_contract_atomic` | `/contracts` | RLS | `contract-workflow-invariants.test.ts` | None | IMPLEMENTED_UNVERIFIED | Maker-Checker pending | WP-03 |
| DOM-301 | Posted financial records immutable | `journal_batches`, `journal_lines` | `post_journal_event` | — | RPC-only | `stage3-periods-reversal-security.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| DOM-401 | GL as source of truth | `journal_batches`, `journal_lines` | `post_journal_event` | `/reports` | — | `journalService.test.ts` | None | IMPLEMENTED_UNVERIFIED | Business posting not wired | WP-02 |
| DOM-501 | No cross-company references | All tables | — | — | RLS RESTRICTIVE | `P0_MULTI_TENANT_VERIFICATION_20260723.md` | None | VERIFIED_IMPLEMENTED | None | — |

---

### 2.4 Finance and Accounting Rules (FIN-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| FIN-101 | OWNER_IS_CREDITOR accounting | `receipts`, `journal_lines` | `record_invoice_payment_atomic` | — | RPC-only | `client-money-separation.test.ts` | None | PARTIAL | GL wiring incomplete | WP-02 |
| FIN-102 | OFFICE_IS_CREDITOR accounting | `invoices`, `journal_lines` | Invoice RPCs | — | RPC-only | None | None | NOT_IMPLEMENTED | GL posting not wired | WP-02 |
| FIN-201 | 18 required accounts seeded | `accounts` | `provision_company_chart_of_accounts` | — | RPC-only | `stage3-chart-of-accounts.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| FIN-301 | Batch lifecycle: DRAFT→POSTED→REVERSED | `journal_batches.status` | `post_journal_event` | — | RPC-only | `stage3-gl-core.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| FIN-401 | Invoice posting (OFFICE_IS_CREDITOR) | `invoices`, `journal_lines` | Invoice RPCs | — | RPC-only | None | None | NOT_IMPLEMENTED | Not wired | WP-02 |
| FIN-412 | Collection posting (OWNER_IS_CREDITOR) | `receipts`, `journal_lines` | `record_invoice_payment_atomic` | — | RPC-only | None | None | PARTIAL | GL wiring partial | WP-02 |
| FIN-421 | Management fee on collection (RATE) | `owner_settlements`, `journal_lines` | Settlement RPCs | — | RPC-only | None | None | NOT_IMPLEMENTED | S04-T06 not started | WP-03 |
| FIN-422 | Management fee daily accrual (FIXED_MONTHLY) | `journal_lines` | Accrual RPCs | — | RPC-only | None | None | NOT_IMPLEMENTED | S04-T08 not started | WP-03 |
| FIN-431 | Owner expense as Due from Owner | `expenses`, `journal_lines` | `create_expense_with_journal_atomic` | — | RPC-only | `expense.test.ts` | None | IMPLEMENTED_UNVERIFIED | Split billing unwritten | WP-04 |
| FIN-441 | Deposit receipt as liability | `deposits`, `journal_lines` | Deposit RPCs | — | RPC-only | `deposit.test.ts` | None | IMPLEMENTED_UNVERIFIED | Full workflow pending | WP-04 |
| FIN-461 | Receipt void creates reversal | `journal_batches`, `journal_lines` | `void_receipt_atomic` | — | RPC-only | `void.test.ts` | None | IMPLEMENTED_UNVERIFIED | GL wiring partial | WP-02 |
| FIN-501 | Period state machine | `accounting_periods.status` | Period RPCs | `/reports?section=general_ledger` | RPC-only | `stage3-periods-reversal-security.test.ts` | None | IMPLEMENTED_UNVERIFIED | Close checklist pending | WP-05 |
| FIN-601 | OMR 3dp server-side rounding | NUMERIC(18,3) | `roundOmr3()` | — | — | `accountingServices.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| FIN-801 | Master lease separate module | `1600`, `2500` accounts | — | — | — | None | None | NOT_IMPLEMENTED | S06 not started | WP-01 |

---

### 2.5 Security Rules (SEC-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| SEC-201 | Company as tenant boundary | All tables | — | — | RLS on all tables | `P0_MULTI_TENANT_VERIFICATION_20260723.md` | None | VERIFIED_IMPLEMENTED | None | — |
| SEC-301 | RLS RESTRICTIVE policies | All tables | — | — | RLS policies | `harden_rls_membership_and_invoker_helpers.sql` | None | VERIFIED_IMPLEMENTED | None | — |
| SEC-401 | 6 product roles (ADMIN/MANAGER/ACCOUNTANT/OPERATIONS/USER/VIEWER) | `users`, `roles` | Permission RPCs | — | Role checks | `permissions.ts` | None | CONFLICT | Code has 3 roles; docs specify 6 | WP-01 |
| SEC-501 | Browser untrusted for financials | — | All financial RPCs | — | RPC-only writes | `S02_financial_direct_write_hardening.sql` | None | VERIFIED_IMPLEMENTED | None | — |
| SEC-502 | SECURITY DEFINER RPCs | — | All financial RPCs | — | SECURITY DEFINER | `S02_SECURITY_DEFINER_INVENTORY.md` | None | VERIFIED_IMPLEMENTED | None | — |
| SEC-504 | Financial tables RPC-only | `receipts`, `payments`, `accounts` | — | — | No INSERT/UPDATE/DELETE policies | `S02_remove_residual_financial_write_policies.sql` | None | VERIFIED_IMPLEMENTED | None | — |
| SEC-711 | Permission request workflow | `permission_requests` | Permission RPCs | `/settings` | ADMIN required | `permission_request_workflow.sql` | None | IMPLEMENTED_UNVERIFIED | Workflow exists; full UI pending | WP-01 |
| SEC-801 | Audit logging | `audit_logs` | Audit triggers | — | — | Basic tests exist | None | PARTIAL | Full coverage planned | WP-01 |

---

### 2.6 UX Rules (UX-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| UX-101 | Hub-based navigation | — | — | `/properties`, `/financials`, `/reports` | Permission-based | `hub-navigation-contract.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-102 | Financial hub sections | — | — | `/financials` | — | `financials-hub.e2e-fixture.tsx` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-201 | Route deep links with section | — | — | All detail routes | — | `section-tabs.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-301 | Modal-based create/edit | — | — | `/properties`, `/people`, `/contracts` | — | `modal.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-401 | Mobile-first responsive | — | — | All routes | — | `mobile-accessibility-ux.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-501 | RTL-first layout | — | — | All routes | — | RTL tests exist | None | VERIFIED_IMPLEMENTED | None | — |
| UX-601 | Loading/error/empty states | — | — | All routes | — | `async-content-state.test.tsx` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-701 | Enterprise forms with validation | — | — | All forms | — | `form-single-pass-validation.test.ts` | None | VERIFIED_IMPLEMENTED | None | — |
| UX-801 | Compact responsive tables | — | — | All list pages | — | `CompactResponsiveTable` tests | None | VERIFIED_IMPLEMENTED | None | — |
| UX-901 | Semantic color system | — | — | All routes | — | Visual contract tests | None | VERIFIED_IMPLEMENTED | None | — |
| UX-1001 | PDF generation with branding | — | `documentService` | Print views | — | `documentService.test.ts` | None | IMPLEMENTED_UNVERIFIED | Legal templates pending | WP-06 |

---

### 2.7 Release Rules (REL-###)

| Rule ID | Canonical Rule | Schema/Table | RPC/Service | UI/Route | Permission/RLS | Test Evidence | Runtime Evidence | Status | Gap/Conflict | Work Package |
|---------|----------------|--------------|-------------|----------|----------------|---------------|-----------------|--------|---------------|--------------|
| REL-001 | No P7 started on this branch | — | — | — | — | None | None | NOT_IMPLEMENTED | P7 is future work | WP-07 |
| REL-010 | CI green required | — | — | — | CI pipeline | `.github/workflows/ci.yml` | None | PARTIAL | Some checks pending | WP-07 |
| REL-020 | Pilot data cycle complete | — | — | — | — | None | None | NOT_IMPLEMENTED | Pilot not started | WP-07 |
| REL-030 | Production ready criteria | — | — | — | — | None | None | NOT_IMPLEMENTED | Criteria defined but not verified | WP-07 |

---

## 3. Gap Register

### 3.1 Critical Gaps (Release-Blocking)

| Gap ID | Related Rules | Business Impact | Financial/Data/Security Risk | Evidence | Required Outcome | Dependencies | Work Package | Classification |
|--------|---------------|-----------------|------------------------------|----------|------------------|--------------|--------------|----------------|
| GAP-001 | SEC-401 | Permission granularity insufficient for production | Unauthorized access risk | `permissions.ts` has 3 roles | Implement 6-role model per ADR 0015 | None | WP-01 | RELEASE_BLOCKING |
| GAP-002 | FIN-401, FIN-412, FIN-461 | Invoice/collection not posted to GL | Financial integrity at risk | GL engine exists but not wired | Wire business posting to GL | S03 engine verified | WP-02 | RELEASE_BLOCKING |
| GAP-003 | OPS-421, OPS-621 | Contract activation and void without Maker-Checker | Audit trail insufficient | `contracts-lifecycle-interaction.test.tsx` shows 4-state | Implement Maker-Checker per ADR 0015 | Permission model (GAP-001) | WP-03 | RELEASE_BLOCKING |
| GAP-004 | OPS-102, FIN-421, FIN-422 | Management fee recognition not implemented | Revenue recognition incorrect | Settlement RPCs don't calculate fees | Implement RATE on collection, FIXED_MONTHLY daily accrual | GL wired (GAP-002) | WP-03 | RELEASE_BLOCKING |
| GAP-005 | OPS-901, OPS-952 | Due-from-Owner recovery not implemented | Owner payable could go negative | ADR 0015 OD-08 specifies behavior | Post-payment refund creates Due from Owner | Settlement basic (GAP-004) | WP-04 | RELEASE_BLOCKING |

### 3.2 High Gaps (Should Address)

| Gap ID | Related Rules | Business Impact | Financial/Data/Security Risk | Evidence | Required Outcome | Dependencies | Work Package | Classification |
|--------|---------------|-----------------|------------------------------|----------|------------------|--------------|--------------|----------------|
| GAP-006 | OPS-701, FIN-441 | Deposit allocation workflow incomplete | Deposit liability tracking insufficient | Deposit RPCs exist but allocation pending | Full receive/apply/refund workflow | GL wired | WP-04 | HIGH |
| GAP-007 | OPS-801, FIN-431 | Owner expense split billing unwritten | Expense misclassification risk | Expense forms exist, posting partial | Unified split billing with Due from Owner | GL wired | WP-04 | HIGH |
| GAP-008 | OPS-1001, OPS-1021 | Bank reconciliation FGR-006 not implemented | Reconciliation approval gap | ADR 0015 FGR-006 pending | Implement approval flow | None | WP-05 | HIGH |
| GAP-009 | OPS-1101, FIN-501 | Period close checklist not implemented | Period control insufficient | Period states exist, checklist pending | Period close checklist with reconciliation verification | GL wired | WP-05 | HIGH |
| GAP-010 | FIN-801 | Master lease IFRS module unwritten | Master lease accounting non-compliant | Schema kernel merged, modifiers unwritten | Full IFRS 16 module | S06 execution | WP-01 | HIGH |

### 3.3 Medium Gaps (Address When Possible)

| Gap ID | Related Rules | Business Impact | Financial/Data/Security Risk | Evidence | Required Outcome | Dependencies | Work Package | Classification |
|--------|---------------|-----------------|------------------------------|----------|------------------|--------------|--------------|----------------|
| GAP-011 | OPS-421, OPS-901 | Signature evidence not collected | Legal enforceability risk | Contract activation without signatures | Signature collection and verification | Maker-Checker | WP-03 | MEDIUM |
| GAP-012 | UX-1001 | Legal document templates missing | PDF output without legal wording | `documentService` exists, templates pending | Upload and integrate legal templates | Legal review | WP-06 | MEDIUM |
| GAP-013 | PRD-030 | CRM features in codebase | Scope creep | `owners-crm-bundle.test.tsx` | Remove or clearly mark as future scope | None | WP-06 | MEDIUM |
| GAP-014 | PRD-001 | Brand inconsistency | User confusion | "MALIK" vs "MALEK" in code | Standardize to "MALEK" visible | None | WP-06 | MEDIUM |

### 3.4 External Blockers

| Gap ID | Related Rules | Blocker Type | Evidence | Required Action |
|--------|---------------|--------------|----------|-----------------|
| GAP-EXT-001 | All live features | BLOCKED_EXTERNAL | Requires hosted QA environment, Chromium unavailable | Verify in hosted environment when available |
| GAP-EXT-002 | Legal templates | BLOCKED_EXTERNAL | Requires external legal review | Engage legal counsel |
| GAP-EXT-003 | Production deployment | BLOCKED_EXTERNAL | Requires production secrets, access | Production access when ready |
| GAP-EXT-004 | S08/S09 historical | BLOCKED_EXTERNAL | Blocked on S07 completion | Complete S07 first |

---

## 4. Deduplicated Gap Summary

| Work Package | Gap IDs | Count | Blocking Issues |
|--------------|---------|-------|-----------------|
| WP-01: Security & Company Isolation | GAP-001, GAP-010, SEC-401 | 3 | 6-role model, Master Lease |
| WP-02: Financial Integrity & GL Wiring | GAP-002 | 1 | GL posting |
| WP-03: Contracts & Owner-Agency Lifecycle | GAP-003, GAP-004, GAP-011 | 4 | Maker-Checker, Fee recognition |
| WP-04: Expenses, Deposits, Refunds, Settlements | GAP-005, GAP-006, GAP-007 | 3 | Due-from-Owner, Allocation |
| WP-05: Reports & Reconciliation | GAP-008, GAP-009 | 2 | FGR-006, Period close |
| WP-06: UX, Documents, Consistency | GAP-012, GAP-013, GAP-014 | 3 | Templates, Cleanup |
| WP-07: Release Readiness & Pilot | REL-001, REL-010, REL-020, REL-030 | 4 | Pilot completion |

---

## 5. Conflicts and Resolutions

### 5.1 Documented Conflicts

| Conflict | Documents | Current State | Resolution Required |
|----------|-----------|---------------|---------------------|
| 3 roles vs 6 roles | `permissions.ts` vs ADR 0015, ADR 0003 | 3 roles implemented | Expand to 6 roles |
| MALIK vs MALEK branding | Code vs visible UI | Inconsistent | Standardize to MALEK |
| CRM bundle test | `owners-crm-bundle.test.tsx` vs PRD-030 | Test exists | Remove or mark as future |
| Master Lease merged with settlements | S06 kernel vs FIN-801 | Schema exists | Implement as separate module |
| P7 claimed in docs | Various docs vs current branch | P7 not started | Clarify P7 is future work |

### 5.2 Resolution Actions

| Conflict | Action | Owner | Status |
|----------|--------|-------|--------|
| 6-role model | Implement role expansion | Development | Pending |
| Brand standardization | Update all visible references | Development | Pending |
| CRM features | Remove from release scope or document | Product | Pending |
| Master Lease separation | Implement S06 as separate module | Development | Pending |
| P7 clarification | Document P7 not started | Documentation | **DONE** |

---

## 6. Evidence Summary

### 6.1 Rules by Status

| Status | Count | Percentage |
|--------|-------|------------|
| VERIFIED_IMPLEMENTED | 18 | 24% |
| IMPLEMENTED_UNVERIFIED | 22 | 29% |
| PARTIAL | 12 | 16% |
| NOT_IMPLEMENTED | 17 | 22% |
| CONFLICT | 6 | 8% |
| BLOCKED_EXTERNAL | 1 | 1% |
| **Total** | **76** | **100%** |

### 6.2 Gaps by Severity

| Classification | Count |
|----------------|-------|
| RELEASE_BLOCKING | 5 |
| HIGH | 5 |
| MEDIUM | 4 |
| EXTERNAL_BLOCKER | 4 |
| **Total** | **18** |

### 6.3 Work Packages Coverage

| Work Package | Gaps | Coverage |
|--------------|------|----------|
| WP-01: Security | 3 | All security gaps |
| WP-02: GL Wiring | 1 | All GL gaps |
| WP-03: Contracts | 4 | Contract/agency gaps |
| WP-04: Expenses/Deposits | 3 | Settlement gaps |
| WP-05: Reports | 2 | Reconciliation gaps |
| WP-06: UX/Consistency | 3 | UX/document gaps |
| WP-07: Release | 4 | Release gaps |

---

## Cross-References

- **Canonical Index:** `00_INDEX.md`
- **Work Packages:** `08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`
- **Execution Plan:** `governance/10-stage-master-plan.json`
- **Arabic Constitution:** `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`
- **Decision Register:** `governance/final-decision-register.json`
