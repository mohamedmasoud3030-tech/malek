# MALEK Canonical Pack — Document 2: Operating Models and Journeys

> **Status:** CANONICAL  
> **Rule ID Prefix:** OPS-###  
> **Effective Date:** 2026-08-10

---

## 1. Operating Model Definitions

### 1.1 OWNER_AGENCY Model

**OPS-101 — Model Characteristics**

| Attribute | Value |
|-----------|-------|
| Office Role | Agent |
| Presentation | Net to owner |
| Collection Model | `OWNER_IS_CREDITOR` |
| GL Treatment | Rent → tenant subledger; collection → Owner Funds Payable |
| Revenue Recognition | Management fees on collection or daily accrual |

**OPS-102 — Revenue Streams**

- RATE commission: percentage of collected rent
- FIXED_MONTHLY: daily-accrued service fee
- Brokerage: on signed contract activation
- Renewal: on renewal activation
- Setup: on accepted handover

---

### 1.2 MASTER_LEASE Model

**OPS-111 — Model Characteristics**

| Attribute | Value |
|-----------|-------|
| Office Role | Principal |
| Presentation | Gross |
| Collection Model | `OFFICE_IS_CREDITOR` |
| GL Treatment | Invoice posts Tenant Receivable + Rental Revenue |
| ROU Treatment | ROU Asset and Lease Liability at commencement |

**OPS-112 — Key Constraints**

- **Separate from owner settlements** — Master lease payments to landlord do not use Owner Payables (2000)
- **Separate accounts required** — Lease Liability (2500), ROU Asset (1600), depreciation expense
- **Vacancy risk** — Office bears sub-tenant vacancy risk
- **IFRS 16 alignment** — Initial measurement, remeasurement, modification rules apply

---

### 1.3 OFFICE_OWNED Model

**OPS-121 — Model Characteristics**

| Attribute | Value |
|-----------|-------|
| Office Role | Owner |
| Presentation | Full revenue |
| Skip Step | Owner agreement not required |
| Other Workflows | All other PM workflows apply |

---

## 2. Property and Unit Onboarding

### 2.1 Property Onboarding Journey

**OPS-201 — Actor:** Office administrator

**OPS-202 — Preconditions:**
- User has `properties.create` permission
- Company exists and is active

**OPS-203 — Journey Steps:**

| Step | Action | State Transition |
|------|--------|------------------|
| 1 | Create property record | → draft |
| 2 | Link property to owner (optional at creation) | — |
| 3 | Create/assign owner agreement (for OWNER_AGENCY) | — |
| 4 | Upload property documents | — |
| 5 | Create unit records | — |
| 6 | Conduct initial inspection | — |
| 7 | Complete risk assessment | — |
| 8 | Final handover with signatures | — |
| 9 | Set property status to active | → active |

**OPS-204 — Financial Effect:** None at property creation; GL impact occurs at tenant contract level

**OPS-205 — Permission Boundary:** `properties.create`, `properties.edit`, `properties.archive`

**OPS-206 — Audit Event:** `property.created`, `property.activated`, `property.archived`

**OPS-207 — Failure Path:** Validation errors shown inline; property saved as draft

**OPS-208 — Implementation Status:** VERIFIED_COMPLETE (basic CRUD; documents and inspection pending)

---

### 2.2 Unit Onboarding Journey

**OPS-221 — Actor:** Office administrator

**OPS-222 — Preconditions:**
- Property exists and is active
- User has `units.create` permission

**OPS-223 — Journey Steps:**

| Step | Action | State Transition |
|------|--------|------------------|
| 1 | Create unit record with rent amount | — |
| 2 | Set initial status (vacant) | → vacant |
| 3 | Assign to property | — |

**OPS-224 — Status Transitions:**
- `vacant` → `occupied` (when contract activated)
- `vacant` → `maintenance` (when flagged)
- `occupied` → `vacant` (when contract expires/terminates)
- `maintenance` → `vacant` (when resolved)

**OPS-225 — Implementation Status:** VERIFIED_COMPLETE

---

## 3. Owner and Tenant Onboarding

### 3.1 Owner Onboarding

**OPS-301 — Actor:** Office administrator

**OPS-302 — Preconditions:** User has `owners.create` permission

**OPS-303 — Journey:**
1. Create person record with type='owner'
2. Create ownership link to property with date range
3. Create owner agreement (if applicable)
4. Upload owner documents

**OPS-304 — Owner Agreement Requirements:**
- `operating_model` explicitly set
- `collection_role` explicitly set
- Commission rate or fixed fee defined
- Date range specified

**OPS-305 — Implementation Status:** VERIFIED_COMPLETE (basic); agreement versioning PARTIAL

---

### 3.2 Tenant Onboarding

**OPS-321 — Actor:** Office administrator

**OPS-322 — Preconditions:**
- Unit exists and is vacant (or `OFFICE_OWNED`)
- User has `people.create` permission

**OPS-323 — Journey:**
1. Create person record with type='tenant' (canonical)
2. Create lease contract linking tenant to unit
3. Collect tenant deposit
4. Upload tenant documents

**OPS-324 — Implementation Status:** VERIFIED_COMPLETE (person-first); deposit PARTIAL

---

## 4. Contract Lifecycle

### 4.1 Contract Creation Journey

**OPS-401 — Actor:** Office administrator with `contracts.create` permission

**OPS-402 — Preconditions:**
- Unit is vacant (or property is OFFICE_OWNED)
- No overlapping active/draft contract exists for unit
- Owner agreement covers contract period (for OWNER_AGENCY)
- `operating_model` and `collection_role` determined from agreement

**OPS-403 — Journey Steps:**

| Step | Action | Validation |
|------|--------|------------|
| 1 | Select unit and tenant | Unit vacant, tenant active |
| 2 | Enter start/end dates | No overlap with existing contract |
| 3 | Enter rent amount | Positive, finite |
| 4 | Select payment frequency | monthly/quarterly/semi-annual/annual |
| 5 | Link owner agreement | Agreement covers period |
| 6 | Preview payment schedule | — |
| 7 | Save as draft | → draft |

**OPS-404 — Financial Effect:** None until activation

**OPS-405 — Status Transitions:**
- `draft` → `active` (upon activation with approval)
- `active` → `expired` (upon end date)
- `active` → `terminated` (upon termination)
- `draft` → `cancelled` (upon cancellation)

**OPS-406 — Permission Boundary:** `contracts.create`, `contracts.edit`, `contracts.activate`

**OPS-407 — Audit Event:** `contract.created`, `contract.activated`, `contract.renewed`, `contract.terminated`

**OPS-408 — Implementation Status:** PARTIAL (4-state lifecycle; Maker-Checker and signatures planned)

---

### 4.2 Contract Activation

**OPS-421 — Actor:** Office administrator with approval authority

**OPS-422 — Preconditions:**
- Contract is in `draft` state
- Unit remains vacant
- Owner agreement still active
- Maker-Checker approval completed (planned)
- Signature evidence provided (planned)

**OPS-423 — Journey:**
1. Review contract terms
2. Approve contract (Maker-Checker)
3. Record signature evidence
4. Activate contract → `active`
5. Freeze payment schedule

**OPS-424 — Financial Effect:**
- For `OWNER_IS_CREDITOR`: no GL entry; rent tracked in tenant subledger
- For `OFFICE_IS_CREDITOR`: invoice posted (planned)
- Brokerage commission recognized (planned)

**OPS-425 — Implementation Status:** PARTIAL (activation exists; approval and signature pending)

---

### 4.3 Contract Renewal

**OPS-441 — Actor:** Office administrator

**OPS-442 — Preconditions:** Original contract is active or expired

**OPS-443 — Journey:**
1. Select renewal option
2. Enter new terms (dates, rent amount)
3. Preview new schedule
4. Create new contract version
5. Activate new contract

**OPS-444 — Financial Effect:** Renewal fee recognized upon activation

**OPS-445 — Implementation Status:** PARTIAL (basic renewal; fee recognition planned)

---

### 4.4 Contract Termination

**OPS-461 — Actor:** Office administrator with `contracts.terminate` permission

**OPS-462 — Preconditions:** Contract is active

**OPS-463 — Journey:**
1. Select termination reason
2. Confirm effective termination date
3. Cancel future unpaid invoices (preserve history)
4. Update contract status → `terminated`
5. Release unit → `vacant`
6. Finalize deposit and settlement

**OPS-464 — Financial Effect:**
- Future invoices cancelled (not deleted)
- Paid invoices and history preserved
- Termination penalty (if contractually specified)

**OPS-465 — Implementation Status:** IMPLEMENTED_UNVERIFIED (basic; penalty calculation planned)

---

## 5. Invoice Generation

### 5.1 Invoice Creation Journey

**OPS-501 — Actor:** System (automated) or administrator

**OPS-502 — Preconditions:**
- Contract is active
- Payment due date reached
- Invoice not already created for period

**OPS-503 — Journey:**
1. Generate invoice from contract schedule
2. Calculate amount based on payment frequency
3. Apply proration if applicable
4. Set status → `unpaid`
5. Record in tenant subledger

**OPS-504 — Financial Effect:**
- `OWNER_IS_CREDITOR`: No GL entry; tracked in tenant subledger
- `OFFICE_IS_CREDITOR`: Dr Tenant Receivable / Cr Rental Revenue (planned)

**OPS-505 — Status Transitions:**
- `unpaid` → `partially_paid` (upon partial payment)
- `unpaid` → `paid` (upon full payment)
- `unpaid` → `overdue` (past due date)
- Any → `cancelled` (upon void)

**OPS-506 — Implementation Status:** IMPLEMENTED_UNVERIFIED (basic; GL wiring in progress)

---

## 6. Collection, Receipt, and Payment

### 6.1 Receipt Recording Journey

**OPS-601 — Actor:** Office administrator with `receipts.create` permission

**OPS-602 — Preconditions:**
- Invoice exists (unpaid or partially paid)
- Payment received from tenant

**OPS-603 — Journey:**
1. Select invoice(s) to pay
2. Enter payment amount
3. Enter payment date and method
4. Record reference number (optional)
5. Submit receipt

**OPS-604 — Financial Effect:**
- For `OWNER_IS_CREDITOR`: Dr Cash/Bank / Cr Owner Funds Payable (2000)
- For `OFFICE_IS_CREDITOR`: Dr Cash/Bank / Cr Tenant Receivable (1201)

**OPS-605 — Permission Boundary:** `receipts.create`, `receipts.void`

**OPS-606 — Audit Event:** `receipt.created`, `receipt.voided`

**OPS-607 — Implementation Status:** IMPLEMENTED_UNVERIFIED (receipt exists; GL wiring in progress)

---

### 6.2 Receipt Voiding Journey

**OPS-621 — Actor:** Administrator with void permission

**OPS-622 — Preconditions:**
- Receipt exists and is not already voided
- Void reason provided

**OPS-623 — Journey:**
1. Select receipt to void
2. Enter void reason
3. Confirm void
4. Create balanced reversal batch
5. Restore invoice to unpaid/partially_paid
6. Update subledger balances

**OPS-624 — Financial Effect:** Balanced reversal of original receipt journal batch

**OPS-625 — Constraints:**
- Void reason required (Maker-Checker)
- Requester cannot self-approve
- Emergency void requires extra reason

**OPS-626 — Implementation Status:** IMPLEMENTED_UNVERIFIED (void exists; Maker-Checker pending)

---

### 6.3 Refund Journey

**OPS-641 — Actor:** Administrator

**OPS-642 — Preconditions:**
- Valid business reason for refund
- Original receipt documented
- Approval obtained (if required)

**OPS-643 — Journey:**
1. Identify overpayment or valid refund scenario
2. Create credit note or reversal
3. Record refund payment (payment-out event)
4. Update subledger

**OPS-644 — Financial Effect:**
- Before settlement: Reduces owner liability, reverses related fees
- After settlement: Creates Due from Owner (1205)

**OPS-645 — Constraint:** Cash refund requires payment-out journal entry

**OPS-646 — Implementation Status:** NOT_IMPLEMENTED (credit note lifecycle planned)

---

## 7. Deposits

### 7.1 Deposit Receipt Journey

**OPS-701 — Actor:** Administrator

**OPS-702 — Preconditions:**
- Tenant identified
- Contract exists (or imminent)
- Deposit amount agreed

**OPS-703 — Journey:**
1. Record deposit from tenant
2. Link to contract (when created)
3. Set status → held
4. Create journal entry

**OPS-704 — Financial Effect:** Dr Cash/Bank / Cr Tenant Deposits Payable (2200)

**OPS-705 — Constraint:** Deposit is liability, never revenue

**OPS-706 — Implementation Status:** IMPLEMENTED_UNVERIFIED (basic; full allocation workflow planned)

---

### 7.2 Deposit Application Journey

**OPS-721 — Actor:** Administrator with approval

**OPS-722 — Preconditions:**
- Approved invoice or claim exists
- Evidence documented
- Allocation to specific invoices recorded

**OPS-723 — Journey:**
1. Select deposit to apply
2. Identify beneficiary (tenant damage, arrears, etc.)
3. Attach approved claim/invoice
4. Create deposit transaction
5. Create journal entry: Dr Tenant Deposits Payable / Cr appropriate account

**OPS-724 — Constraint:** Atomic transaction required; evidence must be documented

**OPS-725 — Implementation Status:** NOT_IMPLEMENTED (full allocation workflow planned)

---

### 7.3 Deposit Refund Journey

**OPS-741 — Actor:** Administrator

**OPS-742 — Preconditions:**
- Contract terminated/expired
- No outstanding claims against deposit
- Final inspection completed

**OPS-743 — Journey:**
1. Verify no outstanding claims
2. Calculate refund amount
3. Create payment-out event
4. Update deposit status
5. Release journal entry

**OPS-744 — Constraint:** Requires payment-out journal entry; deletion of deposit records forbidden

**OPS-745 — Implementation Status:** NOT_IMPLEMENTED (workflow planned)

---

## 8. Owner Expenses

### 8.1 Expense Recording Journey

**OPS-801 — Actor:** Office administrator

**OPS-802 — Preconditions:**
- Expense incurred on behalf of owner
- Property/unit identified
- Amount documented

**OPS-803 — Journey:**
1. Record expense with category
2. Assign responsibility (owner/office/shared)
3. Link to property/unit/contract
4. Submit expense

**OPS-804 — Financial Effect:**
- Owner expense: Dr Due from Owner (1205) / Cr Cash/Bank
- **NOT** posted to office operating expenses (6100)

**OPS-805 — Offsetting Rules:**
- Offset only when agreement explicitly grants right
- Order: (1) owner expenses, (2) office fees/tax, (3) reserve, (4) net payout
- If insufficient payable, balance remains as Due from Owner
- **Owner Payables (2000) must never go negative**

**OPS-806 — Implementation Status:** PARTIAL (basic forms exist; unified split billing unwritten)

---

## 9. Owner Settlements

### 9.1 Settlement Creation Journey

**OPS-901 — Actor:** Office administrator

**OPS-902 — Preconditions:**
- Collection period completed
- Owner has active agreement

**OPS-903 — Journey:**
1. Select owner and agreement
2. Preview collections and expenses for period
3. Server derives settlement totals
4. Create draft settlement
5. Reserve inputs atomically
6. Review preview with source breakdown
7. Approve settlement
8. Record payout

**OPS-904 — Financial Effect:**
- Collections reserved from other settlements
- Management fees deducted
- Expenses offset (if applicable)
- Net payout to owner

**OPS-905 — Atomic Reservation:**
- Inputs reserved at draft creation
- Same collection/expense cannot appear in two active settlements
- Reservation released on cancel; permanent after payment

**OPS-906 — Server-Derived Amounts:**
- All amounts derived server-side
- Re-derived at approval and payment
- Stale-input warning when scope changes

**OPS-907 — Implementation Status:** PARTIAL (reservation exists; Due-from-Owner recovery planned)

---

### 9.2 Settlement Payment Journey

**OPS-921 — Actor:** Administrator

**OPS-922 — Preconditions:**
- Settlement approved
- Payout method selected
- Bank/cash available

**OPS-923 — Journey:**
1. Confirm settlement details
2. Select payment method
3. Record payment reference
4. Execute payout
5. Update settlement status → paid
6. Generate owner statement

**OPS-924 — Financial Effect:** Dr Owner Funds Payable (2000) / Cr Cash/Bank

**OPS-925 — Post-Payment:**
- Refund after payment creates Due from Owner (1205)
- Never negative Owner Payables

**OPS-926 — Implementation Status:** IMPLEMENTED_UNVERIFIED (basic; statement generation planned)

---

## 10. Banking and Reconciliation

### 10.1 Bank CSV Import Journey

**OPS-1001 — Actor:** Administrator

**OPS-1002 — Preconditions:**
- Bank statement exported as CSV
- File under size limit
- No browser direct writes to financial tables

**OPS-1003 — Journey:**
1. Select and upload CSV file
2. Preview rows before writing
3. Map columns
4. Validate entire batch (fail-closed)
5. Import approved rows
6. Record import batch

**OPS-1004 — Fail-Closed Constraints:**
- Any invalid or ambiguous row blocks entire batch
- No silent partial success
- OMR 3 decimal places enforced
- Debit AND credit non-zero = reject row

**OPS-1005 — Duplicate Detection:**
- File hash fingerprint
- Row-level check (date, amount, reference)
- Retry returns same batch

**OPS-1006 — Server Authority:** All counts from server; never client-side totals

**OPS-1007 — Implementation Status:** IMPLEMENTED_UNVERIFIED (import exists; full fail-closed pending)

---

### 10.2 Reconciliation Journey

**OPS-1021 — Actor:** Administrator with permission

**OPS-1022 — Preconditions:**
- Bank transactions imported
- Receipts/payments recorded

**OPS-1023 — Journey:**
1. View unmatched transactions
2. Apply deterministic matching (date + amount)
3. Ignore unrelated items
4. Confirm matches
5. Update reconciliation status

**OPS-1024 — Status Labels:** imported, suggested, reviewed, matched

**OPS-1025 — Implementation Status:** PARTIAL (basic matching exists; FGR-006 approval flow planned)

---

## 11. Period Close

### 11.1 Period Close Journey

**OPS-1101 — Actor:** Accountant/Administrator

**OPS-1102 — Preconditions:**
- All transactions for period entered
- GL/subledger reconciled
- No unresolved differences

**OPS-1103 — Period States:**
| State | Meaning | Constraints |
|-------|---------|-------------|
| OPEN | Normal postings allowed | Default state |
| SOFT_CLOSED | Adjusting entries only | Reopen with admin permission + audit log |
| HARD_CLOSED | Final and irreversible | Cannot reopen; no postings allowed |

**OPS-1104 — Late Posting:**
- Events after close post to first open period
- `effective_date` preserved from original event
- `late_posting=true` flag set
- `posting_date` reflects current period

**OPS-1105 — Implementation Status:** IMPLEMENTED_UNVERIFIED (schema exists; close checklist planned)

---

## 12. Status Summary Table

| Journey | Status | Blocking Issues |
|---------|--------|-----------------|
| Property Onboarding | VERIFIED_COMPLETE | Documents/inspection pending |
| Unit Onboarding | VERIFIED_COMPLETE | None |
| Owner Onboarding | VERIFIED_COMPLETE | Agreement versioning PARTIAL |
| Tenant Onboarding | VERIFIED_COMPLETE | Deposit workflow PARTIAL |
| Contract Lifecycle | PARTIAL | Maker-Checker, signatures planned |
| Invoice Generation | IMPLEMENTED_UNVERIFIED | GL wiring in progress |
| Receipt Recording | IMPLEMENTED_UNVERIFIED | GL wiring in progress |
| Receipt Voiding | IMPLEMENTED_UNVERIFIED | Maker-Checker pending |
| Refund | NOT_IMPLEMENTED | Credit note workflow planned |
| Deposit Receipt | IMPLEMENTED_UNVERIFIED | Full workflow PARTIAL |
| Deposit Application | NOT_IMPLEMENTED | Allocation workflow planned |
| Deposit Refund | NOT_IMPLEMENTED | Payment-out workflow planned |
| Owner Expenses | PARTIAL | Split billing unwritten |
| Owner Settlement | PARTIAL | Due-from-Owner recovery planned |
| Bank Import | IMPLEMENTED_UNVERIFIED | Full fail-closed pending |
| Reconciliation | PARTIAL | FGR-006 approval flow planned |
| Period Close | IMPLEMENTED_UNVERIFIED | Close checklist planned |

---

## Cross-References

- **D01-D18:** `docs/decisions/0011-final-business-accounting-and-operating-policies.md`
- **Arabic Constitution:** `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md`
- **10-Stage Plan:** `governance/10-stage-master-plan.json`
- **GL Specs:** `04_FINANCE_AND_ACCOUNTING_MODEL.md`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
