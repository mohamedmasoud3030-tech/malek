# RPC Reference

## `create_contract_atomic`

### Purpose
Create a contract through validated server-side business rules instead of direct table writes.

### Parameters
- `p_property_id text`
- `p_unit_id uuid`
- `p_tenant_id uuid`
- `p_agreement_id uuid`
- `p_start_date date`
- `p_end_date date`
- `p_rent_amount numeric`
- `p_payment_cycle text`
- `p_payment_terms_id uuid`
- `p_status text`
- `p_cancellation_reason text`
- `p_notes text`
- `p_attachment_url text`

### Protections
- authentication required
- admin/manager role check
- tenant validity check
- property existence check
- unit/property matching check
- overlap prevention
- owner agreement coverage check

### Transaction behavior
- executes as a single server-side mutation
- inserts the contract only after all validations pass

---

## `update_contract_atomic`

### Purpose
Update a contract while preserving lifecycle and overlap invariants.

### Parameters
- `p_contract_id text`
- `p_property_id text`
- `p_unit_id uuid`
- `p_tenant_id uuid`
- `p_agreement_id uuid`
- `p_start_date date`
- `p_end_date date`
- `p_rent_amount numeric`
- `p_payment_cycle text`
- `p_payment_terms_id uuid`
- `p_status text`
- `p_cancellation_reason text`
- `p_notes text`
- `p_attachment_url text`

### Protections
- authentication required
- admin/manager role check
- row lock on target contract
- overlap prevention
- owner agreement coverage validation
- terminated-contract protection logic

### Transaction behavior
- updates the contract atomically after the target row is locked

---

## `renew_contract_atomic`

### Purpose
Expire/close the source contract and create a renewed contract using controlled server-side logic.

### Parameters
- `old_contract_id text`
- `new_contract_data jsonb`

Expected payload fields inside `new_contract_data`:
- `new_start`
- `new_end`
- `new_amount`

### Protections
- authentication required
- admin/manager role check
- row lock on original contract
- active-contract conflict check on unit

### Transaction behavior
- updates the old contract and inserts the renewed contract inside one transaction scope

---

## `terminate_contract_atomic`

### Purpose
Terminate a contract with an explicit reason and clean up future unpaid invoice obligations where applicable.

### Parameters
- `p_contract_id text`
- `p_reason text`

### Protections
- authentication required
- admin/manager role check
- row lock on target contract
- status validation
- required termination reason

### Transaction behavior
- marks the contract terminated
- cancels qualifying future unpaid invoices in the same transaction

---

## `record_invoice_payment_atomic`

### Purpose
Record an invoice payment through the full protected financial path.

### Parameters
- `payload jsonb`

Expected payload fields include:
- `invoice_id`
- `amount`
- `method`
- `date`
- `reference`
- `request_id`

### Protections
- authentication required
- admin/manager role check
- advisory lock on request ID
- idempotency table check
- invoice row lock
- overpayment guard
- configured account check

### Transaction behavior
- posts receipt/payment effects atomically
- writes idempotency record
- returns consistent payment/receipt identifiers

---

## `post_receipt_atomic`

### Purpose
Create a receipt, allocations, and journal entries atomically.

### Parameters
- `payload jsonb`

Expected payload structure:
- `request_id`
- `receipt`
- `allocations`
- `journal_entries`

### Protections
- authentication required
- admin/manager role validation
- request-level idempotency
- deterministic invoice row locking
- overpayment prevention

### Transaction behavior
- inserts receipt
- inserts allocations
- updates invoice paid amounts/status behavior
- inserts journal entries
- returns a single atomic result

---

## `void_receipt_atomic`

### Purpose
Void posted receipt activity while preserving protected reversal behavior.

### Available interfaces
- `void_receipt_atomic(payload jsonb)`
- `void_receipt_atomic(p_receipt_id text, p_voided_at bigint, p_invoice_updates jsonb, p_reverse_entries jsonb)`

### Protections
- authentication required inside the protected path
- admin/manager role validation
- receipt resolution logic for payment-backed identifiers
- idempotent behavior for already-void receipts

### Transaction behavior
- voids receipt state
- updates linked payment state where required
- reverses invoice paid amounts through allocation reversal behavior
- deletes allocations as defined by the existing production flow
- returns a deterministic result payload
