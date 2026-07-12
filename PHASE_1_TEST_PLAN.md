# Phase 1: Financial Safety Lock — Test Plan

**Date:** 2026-07-13  
**Scope:** All Phase 1 migrations and frontend updates  
**Test Environment:** Staging (must match production schema before testing)

---

## Test Categories

| Category | Tests | Priority |
|----------|-------|----------|
| Phase 1A: CASCADE Fixes | 6 tests | CRITICAL |
| Phase 1B: Permission Fixes | 9 tests | HIGH |
| Phase 1C: Expense Update RPC | 12 tests | CRITICAL |
| Phase 1D: Journal Batch Check | 6 tests | MEDIUM |
| Integration / Smoke Tests | 5 tests | CRITICAL |
| **Total** | **38 tests** | |

---

## Phase 1A: CASCADE Fix Tests

### Test 1.1: Hard-delete contract with balance data → expect error
```sql
-- Setup: create a contract with balance data
INSERT INTO contracts (id, property_id, tenant_id, start_date, end_date, rent_amount, status)
VALUES ('test-contract-001', 'test-property', 'test-tenant', '2026-01-01', '2026-12-31', 1000, 'active');

INSERT INTO contract_balances (contract_id, total_invoiced, total_paid, balance_due)
VALUES ('test-contract-001', 12000, 6000, 6000);

-- Test: attempt hard-delete
DELETE FROM contracts WHERE id = 'test-contract-001';

-- Expected: ERROR — violates foreign key constraint contract_balances_contract_id_fkey
-- Cleanup: DELETE FROM contract_balances WHERE contract_id = 'test-contract-001';
--          DELETE FROM contracts WHERE id = 'test-contract-001';
```

### Test 1.2: Hard-delete contract WITHOUT balance data → expect success
```sql
-- Setup: create a contract without balance data
INSERT INTO contracts (id, property_id, tenant_id, start_date, end_date, rent_amount, status)
VALUES ('test-contract-002', 'test-property', 'test-tenant', '2026-01-01', '2026-12-31', 1000, 'active');

-- Test: attempt hard-delete
DELETE FROM contracts WHERE id = 'test-contract-002';

-- Expected: SUCCESS (1 row deleted)
```

### Test 1.3: Hard-delete owner with balance data → expect error
```sql
-- Setup
INSERT INTO owners (id, full_name) VALUES ('test-owner-001', 'Test Owner');
INSERT INTO owner_balances (owner_id, total_income, total_expenses, commission, net_balance)
VALUES ('test-owner-001', 50000, 10000, 5000, 35000);

-- Test
DELETE FROM owners WHERE id = 'test-owner-001';

-- Expected: ERROR — violates foreign key constraint owner_balances_owner_id_fkey
```

### Test 1.4: Hard-delete receipt with allocations → expect error
```sql
-- Setup
INSERT INTO receipts (id, amount, status) VALUES ('test-receipt-001', 1000, 'POSTED');
INSERT INTO receipt_allocations (id, receipt_id, invoice_id, amount)
VALUES ('test-alloc-001', 'test-receipt-001', 'test-invoice', 1000);

-- Test
DELETE FROM receipts WHERE id = 'test-receipt-001';

-- Expected: ERROR — violates foreign key constraint receipt_allocations_receipt_id_fkey
```

### Test 1.5: Void receipt flow still works (allocations deleted first)
```sql
-- Setup: create receipt with allocations (use real IDs)
-- Test: call void_receipt_atomic via RPC
SELECT public.void_receipt_atomic(jsonb_build_object('receipt_id', 'test-receipt-id'));

-- Expected: SUCCESS — receipt status = 'VOID', allocations deleted
-- Verify: SELECT count(*) FROM receipt_allocations WHERE receipt_id = 'test-receipt-id'; → 0
```

### Test 1.6: Soft-delete contract with balance data → expect success
```sql
-- Setup: contract with balance data
-- Test: UPDATE contracts SET deleted_at = now() WHERE id = 'test-contract-id';
-- Expected: SUCCESS — balance data preserved
```

---

## Phase 1B: Permission Fix Tests

### Test 2.1: USER role calls create_expense_with_journal_atomic → expect error
```sql
-- Setup: authenticate as USER role
SET LOCAL ROLE authenticated;
-- Simulate USER role via JWT claims

-- Test
SELECT public.create_expense_with_journal_atomic(jsonb_build_object(
  'property_id', 'test-property',
  'category', 'test',
  'amount', 100,
  'expense_date', '2026-07-13'
));

-- Expected: ERROR 42501 — "ADMIN or MANAGER role is required"
```

### Test 2.2: MANAGER role calls create_expense_with_journal_atomic → expect success
```sql
-- Setup: authenticate as MANAGER role
-- Test: same as above
-- Expected: SUCCESS — expense created with journal entries
```

### Test 2.3: ADMIN role calls create_expense_with_journal_atomic → expect success
```sql
-- Setup: authenticate as ADMIN role
-- Test: same as above
-- Expected: SUCCESS
```

### Test 2.4: Unauthenticated user calls void_receipt_atomic(jsonb) → expect permission denied
```sql
-- Setup: no authentication
-- Test
SELECT public.void_receipt_atomic(jsonb_build_object('receipt_id', 'test'));

-- Expected: ERROR — permission denied for function (not "Authentication required" from inside)
```

### Test 2.5: Authenticated user calls void_receipt_atomic(jsonb) → expect success
```sql
-- Setup: authenticate as ADMIN/MANAGER
-- Test: void a real receipt
-- Expected: SUCCESS
```

### Test 2.6: rpt_owner_statement runs as SECURITY DEFINER
```sql
-- Verify
SELECT prosecdef FROM pg_proc
WHERE proname = 'rpt_owner_statement' AND pronamespace = 'public'::regnamespace;

-- Expected: true
```

### Test 2.7: rpt_tenant_statement runs as SECURITY DEFINER
```sql
-- Verify
SELECT prosecdef FROM pg_proc
WHERE proname = 'rpt_tenant_statement' AND pronamespace = 'public'::regnamespace;

-- Expected: true
```

### Test 2.8: Report RPCs have pinned search_path
```sql
-- Verify
SELECT proconfig FROM pg_proc
WHERE proname IN ('rpt_owner_statement', 'rpt_tenant_statement')
  AND pronamespace = 'public'::regnamespace;

-- Expected: {search_path=public,pg_temp} for both
```

### Test 2.9: Authenticated user can call report RPCs
```sql
-- Test: call rpt_owner_statement with valid owner_id
SELECT public.rpt_owner_statement('test-owner-id', '2026-01-01', '2026-12-31');

-- Expected: SUCCESS — returns JSONB report
```

---

## Phase 1C: Expense Update RPC Tests

### Test 3.1: Update expense amount → verify journal entries created
```sql
-- Setup: create expense with amount 1000
SELECT public.create_expense_with_journal_atomic(jsonb_build_object(
  'property_id', 'test-property',
  'category', 'maintenance',
  'amount', 1000,
  'expense_date', '2026-07-13'
));
-- Note the returned expense_id

-- Count journal entries before update
SELECT count(*) FROM journal_entries WHERE entity_id = '<expense_id>' AND entity_type = 'expense';
-- Expected: 2 (original DEBIT + CREDIT)

-- Test: update amount to 1500
SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'expense_id', '<expense_id>',
  'amount', 1500
));

-- Count journal entries after update
SELECT count(*) FROM journal_entries WHERE entity_id = '<expense_id>';
-- Expected: 6 (2 original + 2 reversal + 2 new)
```

### Test 3.2: Update expense category only (no amount change) → no new journal entries
```sql
-- Setup: create expense
-- Test: update category only
SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'expense_id', '<expense_id>',
  'amount', 1000,  -- same amount
  'category', 'utilities'
));

-- Verify: only 2 journal entries (original), no new ones
```

### Test 3.3: Update expense with same amount → idempotent
```sql
-- Test: call update twice with same request_id
SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'request_id', 'same-request-id',
  'expense_id', '<expense_id>',
  'amount', 1500
));

SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'request_id', 'same-request-id',
  'expense_id', '<expense_id>',
  'amount', 1500
));

-- Expected: second call returns idempotent: true, no duplicate journal entries
```

### Test 3.4: USER role attempts expense update → expect error
```sql
-- Test: call as USER role
-- Expected: ERROR 42501
```

### Test 3.5: Update non-existent expense → expect error
```sql
-- Test
SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'expense_id', '00000000-0000-0000-0000-000000000000',
  'amount', 100
));

-- Expected: ERROR — "Expense not found or has been deleted"
```

### Test 3.6: Update with zero amount → expect error
```sql
-- Test
SELECT public.update_expense_with_journal_atomic(jsonb_build_object(
  'expense_id', '<valid_id>',
  'amount', 0
));

-- Expected: ERROR — "amount must be greater than zero"
```

### Test 3.7: Update with negative amount → expect error
```sql
-- Expected: ERROR — "amount must be greater than zero"
```

### Test 3.8: Verify audit log entry created
```sql
-- After update, check audit_log
SELECT * FROM audit_log
WHERE entity = 'expenses' AND entity_id = '<expense_id>' AND action = 'UPDATE'
ORDER BY created_at DESC LIMIT 1;

-- Expected: row with note containing "Expense amount updated from X to Y with journal adjustment"
```

### Test 3.9: Verify journal entry types are correct
```sql
-- After amount increase, verify entry types
SELECT type, amount, entity_type, no
FROM journal_entries
WHERE entity_id = '<expense_id>'
ORDER BY created_at;

-- Expected:
-- DEBIT,  1000, 'expense',           'EXP-...-D'  (original)
-- CREDIT, 1000, 'expense',           'EXP-...-C'  (original)
-- CREDIT, 1000, 'expense_reversal',  'EXP-REV-...-D'  (reversal)
-- DEBIT,  1000, 'expense_reversal',  'EXP-REV-...-C'  (reversal)
-- DEBIT,  1500, 'expense_update',    'EXP-UPD-...-D'  (new)
-- CREDIT, 1500, 'expense_update',    'EXP-UPD-...-C'  (new)
```

### Test 3.10: Frontend expense update flow
```
1. Open expense detail page
2. Change amount from 1000 to 1500
3. Save
4. Verify: expense amount updated in UI
5. Verify: no errors in console
6. Verify: journal entries created (check via admin panel or direct query)
```

### Test 3.11: Frontend expense update with no amount change
```
1. Open expense detail page
2. Change category only
3. Save
4. Verify: expense updated, no new journal entries
```

### Test 3.12: Frontend expense update as USER role → expect blocked
```
1. Login as USER role
2. Navigate to expense edit page (should be blocked by route guard)
3. If somehow reached, attempt to save → expect RPC error
```

---

## Phase 1D: Journal Batch Check Tests

### Test 4.1: Insert entries with batch_id → verify warning logged
```sql
-- Insert unbalanced batch
INSERT INTO journal_entries (id, date, account_id, amount, type, batch_id)
VALUES (gen_random_uuid(), '2026-07-13', '6100', 1000, 'DEBIT', 'test-batch-001');

INSERT INTO journal_entries (id, date, account_id, amount, type, batch_id)
VALUES (gen_random_uuid(), '2026-07-13', '1111', 500, 'CREDIT', 'test-batch-001');

-- Check audit_log for warning
SELECT * FROM audit_log
WHERE action = 'JOURNAL_BATCH_IMBALANCE_WARNING' AND entity_id = 'test-batch-001';

-- Expected: warning logged with imbalance = 500
```

### Test 4.2: Insert balanced batch → no warning
```sql
-- Insert balanced batch
INSERT INTO journal_entries (id, date, account_id, amount, type, batch_id)
VALUES (gen_random_uuid(), '2026-07-13', '6100', 1000, 'DEBIT', 'test-batch-002');

INSERT INTO journal_entries (id, date, account_id, amount, type, batch_id)
VALUES (gen_random_uuid(), '2026-07-13', '1111', 1000, 'CREDIT', 'test-batch-002');

-- Check audit_log — no warning for this batch
-- Expected: no JOURNAL_BATCH_IMBALANCE_WARNING for test-batch-002
```

### Test 4.3: Close balanced batch → expect success
```sql
SELECT public.close_journal_batch('test-batch-002');

-- Expected: { success: true, balanced: true, entry_count: 2, ... }
```

### Test 4.4: Close unbalanced batch → expect error
```sql
SELECT public.close_journal_batch('test-batch-001');

-- Expected: ERROR — "Batch ... is unbalanced"
```

### Test 4.5: Close non-existent batch → expect error
```sql
SELECT public.close_journal_batch('00000000-0000-0000-0000-000000000000');

-- Expected: ERROR — "Batch ... not found or has no entries"
```

### Test 4.6: Entries without batch_id → no trigger fires
```sql
-- Insert entries without batch_id (existing RPCs do this)
INSERT INTO journal_entries (id, date, account_id, amount, type)
VALUES (gen_random_uuid(), '2026-07-13', '6100', 1000, 'DEBIT');

-- Expected: no warning, no error — trigger doesn't fire for null batch_id
```

---

## Integration / Smoke Tests

### Test 5.1: Full payment flow end-to-end
```
1. Create contract (via create_contract_atomic)
2. Generate invoice (via generate_invoices_from_active_contracts)
3. Record payment (via record_invoice_payment_atomic)
4. Verify: payment created, receipt created, allocation created, journal entries created
5. Void receipt (via void_receipt_atomic)
6. Verify: receipt voided, allocations deleted, invoice paid_amount decremented
```

### Test 5.2: Full expense flow end-to-end
```
1. Create expense (via create_expense_with_journal_atomic)
2. Verify: expense created, 2 journal entries created
3. Update expense amount (via update_expense_with_journal_atomic)
4. Verify: expense updated, 4 new journal entries created (2 reversal + 2 new)
5. Check trial balance: expense total matches journal DEBITs
```

### Test 5.3: Report generation after updates
```
1. Create multiple expenses
2. Update some expense amounts
3. Run rpt_trial_balance
4. Verify: expense totals match actual expense amounts (not stale journal amounts)
5. Run rpt_income_statement
6. Verify: expense breakdown is correct
```

### Test 5.4: Role-based access control
```
1. Login as USER role
2. Attempt to create expense → expect blocked
3. Attempt to update expense → expect blocked
4. Attempt to void receipt → expect blocked
5. Attempt to view reports → expect success (read-only)
```

### Test 5.5: Idempotency verification
```
1. Record payment with request_id 'test-001'
2. Record same payment with request_id 'test-001' again
3. Verify: second call returns idempotent: true, no duplicate records
4. Create expense with request_id 'test-002'
5. Create same expense with request_id 'test-002' again
6. Verify: second call returns idempotent: true
```

---

## Test Execution Checklist

- [ ] Phase 1A tests (6/6 passed)
- [ ] Phase 1B tests (9/9 passed)
- [ ] Phase 1C tests (12/12 passed)
- [ ] Phase 1D tests (6/6 passed)
- [ ] Integration tests (5/5 passed)
- [ ] All tests passed: **38/38**

---

## Test Results Template

| Test ID | Description | Expected | Actual | Status |
|---------|-------------|----------|--------|--------|
| 1.1 | Hard-delete contract with balance | Error | | ⬜ |
| 1.2 | Hard-delete contract without balance | Success | | ⬜ |
| ... | ... | ... | ... | ⬜ |

---

**Status: AWAITING TEST EXECUTION ON STAGING**
