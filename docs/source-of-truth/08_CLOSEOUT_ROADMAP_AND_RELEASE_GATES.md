# MALEK Canonical Pack — Document 8: ClosEOUT Roadmap and Release Gates

> **Status:** CANONICAL  
> **Rule ID Prefix:** REL-###  
> **Effective Date:** 2026-08-10

---

## 1. Work Package Overview

This document converts the Gap Register from Document 7 into a finite closeout program. Each work package groups related gaps and defines exit criteria.

---

## 2. Work Package Definitions

### WP-01: Security and Company Isolation

**Included Gap IDs:** GAP-001, GAP-010, SEC-401 (conflict)

**Intended Outcome:**
- 6 product roles implemented per ADR 0015 and ADR 0003
- Master Lease accounting module implemented as separate principal model
- Full permission granularity for production use

**Explicit Exclusions:**
- UI implementation of new permission features (handled in WP-06)
- Master Lease IFRS modifier modules beyond kernel (separate S06 execution)

**Dependencies:**
- None (foundation work)

**Data/Migration Impact:**
- Permission table schema changes
- New role entries
- Master Lease account provisioning

**Security/Accounting Risk:**
- HIGH — Permission model is foundational to production readiness
- Unauthorized access risk if not implemented

**Required Implementation Layers:**
1. Database: Role and permission table expansion
2. RPC: Permission evaluation logic update
3. JWT: Role claim expansion
4. UI: Role-based visibility updates

**Smallest Meaningful Verification:**
- 6 roles appear in permission dropdown
- Each role has distinct access patterns
- Cross-role access is correctly denied

**Exit Criteria:**
- [ ] 6 roles implemented in schema
- [ ] Role assignment UI functional
- [ ] Permission checks verified per role
- [ ] Master Lease schema kernel deployed
- [ ] No permission escalation possible
- [ ] Permission tests green

**Rollback Considerations:**
- Database migration rollback
- Role assignments reset to existing roles

---

### WP-02: Financial Integrity and GL Wiring

**Included Gap IDs:** GAP-002 (FIN-401, FIN-412, FIN-461)

**Intended Outcome:**
- All business events post to GL with balanced journal entries
- Invoice issuance posts correctly for both collection models
- Receipt recording posts correctly for both collection models
- Void operations create balanced reversal batches

**Explicit Exclusions:**
- Fee recognition (handled in WP-03)
- Deposit GL posting (handled in WP-04)
- Master Lease GL posting (handled in WP-01)

**Dependencies:**
- S03 GL engine verified (READY_FOR_INDEPENDENT_REVIEW)
- Accounting period management implemented

**Data/Migration Impact:**
- Invoice posting RPC modifications
- Receipt posting RPC modifications
- Void RPC modifications
- Journal entry verification tests

**Security/Accounting Risk:**
- CRITICAL — Financial integrity depends on correct GL wiring
- Incorrect posting could corrupt financial history

**Required Implementation Layers:**
1. Database: Journal entry creation in invoice/ receipt/void RPCs
2. RPC: Business logic → GL posting integration
3. Service: Amount derivation and precision
4. UI: GL verification views

**Smallest Meaningful Verification:**
- Invoice created → journal batch posted
- Receipt recorded → journal batch posted
- Void executed → reversal batch posted
- All batches balanced (debits = credits)
- Period assignment correct

**Exit Criteria:**
- [ ] Invoice posting creates balanced GL entry
- [ ] Receipt posting creates balanced GL entry
- [ ] OWNER_IS_CREDITOR posts to 2000 (Owner Payable)
- [ ] OFFICE_IS_CREDITOR posts to 1201 (Tenant AR)
- [ ] Void creates balanced reversal
- [ ] Period assignment correct for all events
- [ ] GL/subledger reconciliation passes
- [ ] Financial acceptance tests green

**Rollback Considerations:**
- GL entries are append-only; reversal is the rollback mechanism
- Cannot delete GL history

---

### WP-03: Contracts and Owner-Agency Lifecycle

**Included Gap IDs:** GAP-003, GAP-004, GAP-011 (OPS-421, OPS-621, OPS-102, FIN-421, FIN-422)

**Intended Outcome:**
- Maker-Checker separation for contract activation and void operations
- Contract signature evidence collection and verification
- Management fee recognition on collection (RATE) and daily accrual (FIXED_MONTHLY)
- Server-side amount derivation for all financial operations

**Explicit Exclusions:**
- Legal template wording (requires external legal review)
- Jurisdiction-specific contract requirements

**Dependencies:**
- WP-01 (permission model for Maker-Checker roles)
- WP-02 (GL wiring for fee posting)

**Data/Migration Impact:**
- Contract workflow state expansion
- Signature evidence storage
- Fee calculation and posting
- Audit log entries

**Security/Accounting Risk:**
- HIGH — Incorrect fee recognition violates revenue recognition rules
- Maker-Checker bypass risks audit trail validity

**Required Implementation Layers:**
1. Database: Workflow state and signature tables
2. RPC: Maker-Checker validation logic
3. Service: Fee calculation (RATE on collection, FIXED_MONTHLY daily)
4. UI: Approval workflow, signature upload
5. GL: Fee posting integration

**Smallest Meaningful Verification:**
- Creator cannot approve own contract
- Maker-Checker required for activation
- RATE fee calculated on collection
- FIXED_MONTHLY fee accrued daily
- Fee amount matches contract terms
- Fee posted to correct GL account

**Exit Criteria:**
- [ ] Maker-Checker enforced for contract activation
- [ ] Maker-Checker enforced for receipt void
- [ ] Emergency void requires extra reason
- [ ] Signature evidence collected before activation
- [ ] RATE fee = contract_rate × collection_amount
- [ ] FIXED_MONTHLY fee = monthly_fee / days_in_month per day
- [ ] Fee amounts server-derived, not client-provided
- [ ] Fee GL posting verified
- [ ] Audit trail complete

**Rollback Considerations:**
- Workflow state changes reversible
- Fee reversals via adjustment entries

---

### WP-04: Expenses, Deposits, Refunds, and Settlements

**Included Gap IDs:** GAP-005, GAP-006, GAP-007 (OPS-901, OPS-952, OPS-701, OPS-801)

**Intended Outcome:**
- Owner expenses booked as Due from Owner (1205)
- Deposit receive/apply/refund workflow complete with GL posting
- Owner settlement with atomic reservation
- Due-from-Owner recovery for post-payment refunds

**Explicit Exclusions:**
- Legal template wording for deposit receipts
- Automatic deposit application rules

**Dependencies:**
- WP-02 (GL wiring foundation)
- WP-03 (fee recognition for settlement)

**Data/Migration Impact:**
- Deposit transaction atomic operations
- Due-from-Owner tracking
- Settlement reservation implementation
- GL posting for all settlement components

**Security/Accounting Risk:**
- HIGH — Owner fund segregation critical for trust
- Incorrect deposit treatment creates liability issues

**Required Implementation Layers:**
1. Database: Deposit transaction table, Due-from-Owner tracking
2. RPC: Atomic deposit operations, settlement reservation
3. Service: Offset calculation, Due-from-Owner recovery
4. GL: Due-from-Owner posting, deposit liability posting
5. UI: Deposit workflow, Due-from-Owner visibility

**Smallest Meaningful Verification:**
- Owner expense → Dr 1205 Due from Owners
- Deposit receipt → Cr 2200 Tenant Deposits Payable
- Deposit application → balanced entry with evidence
- Settlement reservation atomic
- Same receipt/expense not in two active settlements
- Post-payment refund → Due from Owner created
- Owner Payable never goes negative

**Exit Criteria:**
- [ ] Owner expense booked to 1205
- [ ] Office expense booked to 6100
- [ ] Deposit receipt creates liability
- [ ] Deposit application with evidence
- [ ] Deposit refund with payment-out event
- [ ] Settlement reservation atomic
- [ ] Settlement totals server-derived
- [ ] Due-from-Owner created on post-payment refund
- [ ] GL/subledger reconciliation verified
- [ ] Settlement acceptance tests green

**Rollback Considerations:**
- Financial corrections via adjustment entries
- Deposit transactions immutable after completion

---

### WP-05: Reports and Reconciliation

**Included Gap IDs:** GAP-008, GAP-009 (OPS-1001, OPS-1021, OPS-1101, FIN-501)

**Intended Outcome:**
- FGR-006 approval flow for bank reconciliation
- Period close checklist with reconciliation verification
- Complete financial statement generation from GL
- Subledger-to-GL reconciliation dashboard

**Explicit Exclusions:**
- Advanced analytics and forecasting
- Multi-company consolidated reports

**Dependencies:**
- WP-02 (GL wiring for statement generation)
- WP-04 (deposit and expense posting)

**Data/Migration Impact:**
- Reconciliation approval workflow
- Period close checklist tracking
- Statement generation queries

**Security/Accounting Risk:**
- MEDIUM — Reports must reflect true financial position
- Incorrect statements could mislead stakeholders

**Required Implementation Layers:**
1. Database: Reconciliation status, approval records
2. RPC: Approval workflow validation
3. Service: Statement generation from GL
4. UI: Approval flow, close checklist, reconciliation dashboard
5. Reports: Trial balance, income statement, balance sheet

**Smallest Meaningful Verification:**
- FGR-006 approval required for final reconciliation
- Period close blocked if differences exist
- Trial balance debits = credits
- Income statement totals match GL
- Balance sheet balances

**Exit Criteria:**
- [ ] Bank reconciliation requires approval
- [ ] Period close checklist complete
- [ ] Period soft-close blocks normal postings
- [ ] Period hard-close irreversible
- [ ] Late posting routes to first open period
- [ ] Trial balance balances
- [ ] Income statement totals correct
- [ ] Balance sheet balances
- [ ] Subledger reconciliation verified
- [ ] Report acceptance tests green

**Rollback Considerations:**
- Period can be reopened (if SOFT_CLOSED)
- Hard-closed periods cannot be reopened

---

### WP-06: UX, Documents, and Consistency

**Included Gap IDs:** GAP-012, GAP-013, GAP-014 (UX-1001, PRD-030, PRD-001)

**Intended Outcome:**
- Legal document templates integrated for print output
- CRM features removed or clearly documented as future scope
- Brand consistency (MALEK visible, MALIK eliminated)
- UI consistency across all modules

**Explicit Exclusions:**
- New feature development
- Major UX redesigns

**Dependencies:**
- None (cleanup work)

**Data/Migration Impact:**
- Document template storage
- Branding asset updates

**Security/Accounting Risk:**
- LOW — UX consistency improvements

**Required Implementation Layers:**
1. Storage: Legal template upload
2. Service: Template integration with documentService
3. UI: Brand updates, CRM feature visibility
4. Code: Remove or mark CRM features

**Smallest Meaningful Verification:**
- PDF output uses MALEK branding
- Legal templates appear in print output
- CRM test file marked as future scope or removed
- All visible text uses MALEK

**Exit Criteria:**
- [ ] Legal templates uploaded
- [ ] PDF output correct branding
- [ ] CRM features documented as future scope
- [ ] Brand consistency verified
- [ ] UI consistency audit passed

**Rollback Considerations:**
- Branding changes revert via CSS
- Templates can be replaced

---

### WP-07: Release Readiness and Pilot

**Included Gap IDs:** REL-001, REL-010, REL-020, REL-030 (all release criteria)

**Intended Outcome:**
- All release-blocking gaps resolved
- CI pipeline green
- One-office pilot data cycle completed
- Production launch decision approved

**Explicit Exclusions:**
- P7 (Reports and Reconciliation) was not started
- Multi-office deployment
- Historical correction (S08/S09)

**Dependencies:**
- WP-01 through WP-06 completed

**Data/Migration Impact:**
- Pilot database setup
- Data sanitization for test data

**Security/Accounting Risk:**
- CRITICAL — Production deployment requires all safeguards

**Required Implementation Layers:**
1. CI: All gates green
2. Testing: Acceptance test suite complete
3. Documentation: User guides, runbooks
4. Operations: Deployment process, rollback plan
5. Pilot: Single company, full period

**Smallest Meaningful Verification:**
- Main CI green
- Unit tests pass
- Integration tests pass
- E2E tests pass (desktop, mobile, RTL)
- Pilot company data cycle complete
- No unresolved critical gaps

**Exit Criteria:**
- [ ] Canonical decisions approved (D01-D18)
- [ ] No unresolved release-blocking conflicts
- [ ] Company isolation verified
- [ ] Financial posting and reversal verified
- [ ] GL/subledger reconciliation verified
- [ ] Permissions verified
- [ ] Main CI green
- [ ] Mobile, desktop, RTL acceptance
- [ ] Printable documents acceptance
- [ ] Pilot data cycle completed
- [ ] Release Candidate approved
- [ ] One-office pilot completed
- [ ] Production launch decision recorded

**Rollback Considerations:**
- Deployment rollback via previous image
- Financial reversal via adjustment entries

---

## 3. Release Gate Definitions

### Gate 1: Canonical Decisions Approved
**Owner:** Product Owner  
**Criteria:**
- [ ] D01-D18 in final-decision-register.json all FINAL
- [ ] 00_INDEX.md in place
- [ ] All 8 canonical documents created
- [ ] No BLOCKED or PROVISIONAL decisions

### Gate 2: No Unresolved Release-Blocking Conflict
**Owner:** Technical Lead  
**Criteria:**
- [ ] SEC-401 conflict resolved (6-role model)
- [ ] No CONFLICT status in traceability matrix
- [ ] All RELEASE_BLOCKING gaps in work packages

### Gate 3: Company Isolation Verified
**Owner:** Security  
**Criteria:**
- [ ] RLS policies on all tables verified
- [ ] Cross-company access denied
- [ ] Multi-company JWT selection functional
- [ ] Security tests green

### Gate 4: Financial Posting and Reversal Verified
**Owner:** Accounting/Finance  
**Criteria:**
- [ ] Invoice posting creates balanced GL entry
- [ ] Receipt posting creates balanced GL entry
- [ ] Void creates balanced reversal
- [ ] GL wiring acceptance tests green

### Gate 5: GL/Subledger Reconciliation Verified
**Owner:** Accounting  
**Criteria:**
- [ ] Trial balance balances
- [ ] Subledger-to-GL differences = 0
- [ ] Reconciliation tests green

### Gate 6: Permissions Verified
**Owner:** Security  
**Criteria:**
- [ ] 6 roles implemented
- [ ] Role-based access correct
- [ ] Maker-Checker separation enforced
- [ ] Permission tests green

### Gate 7: Main CI Green
**Owner:** CI/CD  
**Criteria:**
- [ ] All checks pass on main
- [ ] No failing tests
- [ ] Build successful

### Gate 8: Mobile, Desktop, and RTL Acceptance
**Owner:** QA  
**Criteria:**
- [ ] Mobile viewport (375px) functional
- [ ] Desktop viewport (1024px+) functional
- [ ] RTL layout correct
- [ ] Accessibility (WCAG AA) met

### Gate 9: Printable Documents Acceptance
**Owner:** Product  
**Criteria:**
- [ ] Receipt PDF correct
- [ ] Invoice PDF correct
- [ ] Settlement statement PDF correct
- [ ] Branding consistent

### Gate 10: Pilot Data Cycle Completed
**Owner:** Operations  
**Criteria:**
- [ ] One company through full period
- [ ] Collections recorded
- [ ] Settlements processed
- [ ] Bank reconciliation complete

### Gate 11: Release Candidate Approved
**Owner:** Product Owner  
**Criteria:**
- [ ] All Gates 1-10 passed
- [ ] Product owner sign-off
- [ ] Go/No-Go decision recorded

### Gate 12: One-Office Pilot
**Owner:** Operations  
**Criteria:**
- [ ] Live operation with real data
- [ ] No critical issues
- [ ] User acceptance confirmed

### Gate 13: Production Launch Decision
**Owner:** Executive  
**Criteria:**
- [ ] Pilot success confirmed
- [ ] Rollback plan ready
- [ ] Monitoring in place
- [ ] Launch authorized

---

## 4. P7 Prohibition

**P7 (Reports and Subledger Reconciliation) was NOT started on this branch.**

This branch (`arena/019fecf2-malik`) is a documentation-only branch. P7 represents future work that requires:

1. WP-02 (GL Wiring) completion
2. WP-04 (Settlement wiring) completion
3. Dedicated P7 implementation branch
4. S07-T01 through S07-T10 completion

Do not claim P7 is in progress, partially complete, or ready for review based on documentation in this branch.

---

## 5. External Dependencies

| Dependency | Owner | Status | Impact |
|------------|-------|--------|--------|
| Legal document templates | External Legal | PENDING | WP-06 blocked |
| Hosted QA environment | Operations | PENDING | Verification blocked |
| Production secrets | Operations | PENDING | Deployment blocked |
| Accounting sign-off | Finance | PENDING | Release blocked |
| S08 historical analysis | — | BLOCKED | S09 blocked |

---

## 6. Summary

| Work Package | Critical Gaps | Release Blocking | Estimated Status |
|--------------|---------------|-------------------|------------------|
| WP-01: Security | 2 | Yes | Must start |
| WP-02: GL Wiring | 1 | Yes | Must start |
| WP-03: Contracts | 3 | Yes | Must start |
| WP-04: Expenses/Deposits | 2 | Yes | Must start |
| WP-05: Reports | 1 | Yes | After WP-02/04 |
| WP-06: UX/Consistency | 2 | No | Can parallel |
| WP-07: Release | 4 | Yes | Final gate |

**Total Release-Blocking Gaps:** 5 (GAP-001 through GAP-005)

---

## Cross-References

- **Traceability Matrix:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- **Gap Register:** Section 3 of Document 7
- **Execution Plan:** `governance/10-stage-master-plan.json`
- **Decision Register:** `governance/final-decision-register.json`
- **Canonical Index:** `00_INDEX.md`
