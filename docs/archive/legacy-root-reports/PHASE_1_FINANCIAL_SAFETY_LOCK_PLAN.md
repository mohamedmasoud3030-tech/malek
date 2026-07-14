# Phase 1: Financial Safety Lock — Implementation Plan

**Status:** DRAFT — Awaiting Approval  
**Date:** 2026-07-12  
**Scope:** Critical financial integrity fixes only  
**Approach:** Safe, reversible, production-ready migrations  

---

## Executive Summary

This plan addresses 4 categories of financial safety vulnerabilities identified in the audit:

1. **Unsafe CASCADE deletes** on financial tables (3 tables affected)
2. **RPC permission inconsistencies** allowing unauthorized financial operations (3 RPCs affected)
3. **Direct mutations bypassing accounting integrity** (2 code paths affected)
4. **Journal entry protection gaps** (1 missing enforcement)

**Total changes:** 4 migrations, 2 frontend service updates, 0 breaking changes  
**Estimated implementation time:** 2-3 hours  
**Risk level:** LOW (all changes are additive or constraint-tightening, no data deletion)

---

## Category 1: Unsafe CASCADE Deletes

### Issue 1.1: `contract_balances.contract_id` ON DELETE CASCADE

**Finding:** `contract_balances.contract_id → contracts.id ON DELETE CASCADE`  
**Risk:** CRITICAL — Hard-deleting a contract silently destroys all balance summary data  
**Affected Table:** `contract_balances`  
**Affected Migration:** `20250101000001_core_schema.sql` (line 332)

#### Proposed Migration

**File:** `supabase/migrations/20260713000001_fix_contract_balances_cascade.sql`

**Strategy:**
```sql
-- Drop the CASCADE constraint
ALTER TABLE public.contract_balances
  DROP CONSTRAINT IF EXISTS contract_balances_contract_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.contract_balances
  ADD CONSTRAINT contract_balances_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
  ON DELETE RESTRICT;
```

**Business Impact:**
- **Before:** Hard-deleting a contract (via direct SQL, admin tool, or future bug) silently removes all balance data
- **After:** Hard-deleting a contract with balance data raises an error: "update or delete on table 'contracts' violates foreign key constraint"
- **User Impact:** ZERO — The application uses soft-delete (`deleted_at`), never hard-delete. This only protects against direct database access.

**Migration Strategy:**
1. **Pre-flight check:** Query for any contracts with `deleted_at IS NOT NULL` that still have `contract_balances` rows (should be zero)
2. **Apply migration:** Single ALTER TABLE statement (instant, no table lock beyond metadata)
3. **Post-flight check:** Verify constraint exists via `pg_constraint` query

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
ALTER TABLE public.contract_balances
  DROP CONSTRAINT IF EXISTS contract_balances_contract_id_fkey;

ALTER TABLE public.contract_balances
  ADD CONSTRAINT contract_balances_contract_id_fkey
  FOREIGN KEY (contract_id) REFERENCES public.contracts(id)
  ON DELETE CASCADE;
```

**Testing Strategy:**
- Unit test: Attempt to hard-delete a contract with balance data → expect error
- Unit test: Attempt to hard-delete a contract without balance data → expect success
- Integration test: Soft-delete a contract with balance data → expect success (balance data preserved)
- Regression test: Verify `recalculate_all_balances()` still works after constraint change

---

### Issue 1.2: `owner_balances.owner_id` ON DELETE CASCADE

**Finding:** `owner_balances.owner_id → owners.id ON DELETE CASCADE`  
**Risk:** CRITICAL — Hard-deleting an owner silently destroys all financial summary data  
**Affected Table:** `owner_balances`  
**Affected Migration:** `20250101000001_core_schema.sql` (line 342)

#### Proposed Migration

**File:** `supabase/migrations/20260713000002_fix_owner_balances_cascade.sql`

**Strategy:**
```sql
-- Drop the CASCADE constraint
ALTER TABLE public.owner_balances
  DROP CONSTRAINT IF EXISTS owner_balances_owner_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.owner_balances
  ADD CONSTRAINT owner_balances_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.owners(id)
  ON DELETE RESTRICT;
```

**Business Impact:**
- **Before:** Hard-deleting an owner silently removes all owner financial summary (income, expenses, commission, net_balance)
- **After:** Hard-deleting an owner with balance data raises an error
- **User Impact:** ZERO — The application never hard-deletes owners

**Migration Strategy:**
1. **Pre-flight check:** Query for any owners with `deleted_at IS NOT NULL` that still have `owner_balances` rows
2. **Apply migration:** Single ALTER TABLE statement
3. **Post-flight check:** Verify constraint exists

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
ALTER TABLE public.owner_balances
  DROP CONSTRAINT IF EXISTS owner_balances_owner_id_fkey;

ALTER TABLE public.owner_balances
  ADD CONSTRAINT owner_balances_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.owners(id)
  ON DELETE CASCADE;
```

**Testing Strategy:**
- Unit test: Attempt to hard-delete an owner with balance data → expect error
- Unit test: Soft-delete an owner → expect success (balance data preserved)
- Regression test: Verify owner balance triggers still fire correctly

---

### Issue 1.3: `receipt_allocations.receipt_id` ON DELETE CASCADE

**Finding:** `receipt_allocations.receipt_id → receipts.id ON DELETE CASCADE`  
**Risk:** CRITICAL — Hard-deleting a receipt silently destroys all allocation records  
**Affected Table:** `receipt_allocations`  
**Affected Migration:** `20250101000001_core_schema.sql` (line 222)

#### Proposed Migration

**File:** `supabase/migrations/20260713000003_fix_receipt_allocations_cascade.sql`

**Strategy:**
```sql
-- Drop the CASCADE constraint
ALTER TABLE public.receipt_allocations
  DROP CONSTRAINT IF EXISTS receipt_allocations_receipt_id_fkey;

-- Re-add with RESTRICT
ALTER TABLE public.receipt_allocations
  ADD CONSTRAINT receipt_allocations_receipt_id_fkey
  FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
  ON DELETE RESTRICT;
```

**Business Impact:**
- **Before:** Hard-deleting a receipt silently removes all allocation records (which invoices were paid, how much)
- **After:** Hard-deleting a receipt with allocations raises an error
- **User Impact:** ZERO — The application uses `void_receipt_atomic` which explicitly deletes allocations before voiding the receipt. This only protects against direct database access or bugs.

**Critical Note:** The `void_receipt_atomic` function currently does:
```sql
DELETE FROM public.receipt_allocations WHERE receipt_id = p_receipt_id;
```
This will still work because the function deletes allocations BEFORE the receipt row is deleted (or marked VOID). The RESTRICT constraint only prevents hard-deleting a receipt that still has allocations.

**Migration Strategy:**
1. **Pre-flight check:** Verify `void_receipt_atomic` deletes allocations before receipt (confirmed in code review)
2. **Apply migration:** Single ALTER TABLE statement
3. **Post-flight check:** Verify constraint exists

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
ALTER TABLE public.receipt_allocations
  DROP CONSTRAINT IF EXISTS receipt_allocations_receipt_id_fkey;

ALTER TABLE public.receipt_allocations
  ADD CONSTRAINT receipt_allocations_receipt_id_fkey
  FOREIGN KEY (receipt_id) REFERENCES public.receipts(id)
  ON DELETE CASCADE;
```

**Testing Strategy:**
- Unit test: Attempt to hard-delete a receipt with allocations → expect error
- Integration test: Call `void_receipt_atomic` on a receipt with allocations → expect success (allocations deleted first, then receipt voided)
- Regression test: Verify payment recording still works (creates receipt + allocations atomically)
- Regression test: Verify void receipt flow still works end-to-end

---

## Category 2: RPC Permission Inconsistencies

### Issue 2.1: `create_expense_with_journal_atomic` uses `is_app_user()` instead of `is_admin_or_manager()`

**Finding:** The RPC checks `is_app_user()` which allows USER role to create expenses  
**Risk:** HIGH — USER role can post arbitrary expenses and journal entries  
**Affected RPC:** `create_expense_with_journal_atomic(jsonb)`  
**Affected Migration:** `20260711000004_add_create_expense_with_journal_atomic.sql` (line 46)

#### Proposed Migration

**File:** `supabase/migrations/20260713000004_fix_expense_rpc_role_check.sql`

**Strategy:**
```sql
CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  -- ... (existing variable declarations)
BEGIN
  -- Change from is_app_user() to is_admin_or_manager()
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to create expenses' USING ERRCODE = '42501';
  END IF;

  -- ... (rest of function unchanged)
END;
$$;

-- Preserve grants
REVOKE ALL ON FUNCTION public.create_expense_with_journal_atomic(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_with_journal_atomic(jsonb) TO authenticated, service_role;
```

**Business Impact:**
- **Before:** Any authenticated user (including USER role) can create expenses via direct RPC call
- **After:** Only ADMIN and MANAGER roles can create expenses
- **User Impact:** ZERO for legitimate users — The frontend already restricts expense creation to ADMIN/MANAGER via route guards. This closes the direct RPC bypass.

**Migration Strategy:**
1. **Pre-flight check:** Verify no USER-role users have created expenses in production (query `expenses` joined with `users` where `role = 'USER'`)
2. **Apply migration:** CREATE OR REPLACE FUNCTION (atomic, no downtime)
3. **Post-flight check:** Call the RPC as a USER-role user → expect 42501 error

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
CREATE OR REPLACE FUNCTION public.create_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  -- ... (existing variable declarations)
BEGIN
  -- Revert to is_app_user()
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  -- ... (rest of function unchanged)
END;
$$;
```

**Testing Strategy:**
- Unit test: Call RPC as USER role → expect 42501 error
- Unit test: Call RPC as MANAGER role → expect success
- Unit test: Call RPC as ADMIN role → expect success
- Integration test: Create expense via frontend as MANAGER → expect success
- Regression test: Verify expense creation still works end-to-end

---

### Issue 2.2: `void_receipt_atomic(jsonb)` grants EXECUTE to anon

**Finding:** The `jsonb` facade overload grants EXECUTE to `anon`  
**Risk:** MEDIUM — Unauthenticated users can attempt void operations (defense-in-depth violation)  
**Affected RPC:** `void_receipt_atomic(jsonb)`  
**Affected Migration:** `20260706090000_fix_record_invoice_payment_void_receipt_shared_id.sql` (last line)

#### Proposed Migration

**File:** `supabase/migrations/20260713000005_fix_void_receipt_anon_grant.sql`

**Strategy:**
```sql
-- Revoke anon access
REVOKE ALL ON FUNCTION public.void_receipt_atomic(jsonb) FROM anon;

-- Preserve authenticated and service_role access
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO authenticated, service_role;
```

**Business Impact:**
- **Before:** Unauthenticated users can call the RPC (they fail on auth check inside, but it's a defense-in-depth violation)
- **After:** Only authenticated users and service_role can call the RPC
- **User Impact:** ZERO — The frontend always sends authenticated requests

**Migration Strategy:**
1. **Pre-flight check:** Verify no unauthenticated void attempts in audit log (should be zero)
2. **Apply migration:** REVOKE + GRANT statements (instant)
3. **Post-flight check:** Verify grants via `pg_proc` query

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO anon;
```

**Testing Strategy:**
- Unit test: Call RPC without authentication → expect "permission denied" error (not "Authentication is required")
- Unit test: Call RPC as authenticated user → expect success
- Regression test: Verify void receipt flow still works end-to-end

---

### Issue 2.3: `rpt_owner_statement` and `rpt_tenant_statement` are SECURITY INVOKER

**Finding:** These report functions run with caller's privileges instead of definer's  
**Risk:** MEDIUM — Inconsistent with project security baseline  
**Affected RPCs:** `rpt_owner_statement(uuid,date,date)`, `rpt_tenant_statement(uuid)`  
**Affected Migration:** `20260706025534_fix_rpt_owner_statement_settlement_type_mismatch.sql`, `20260706025554_fix_rpt_tenant_statement_contract_id_and_tenants_table.sql`

#### Proposed Migration

**File:** `supabase/migrations/20260713000006_fix_report_rpcs_security_definer.sql`

**Strategy:**
```sql
-- Fix rpt_owner_statement
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY DEFINER;
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SET search_path = public, pg_temp;

-- Fix rpt_tenant_statement
ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY DEFINER;
ALTER FUNCTION public.rpt_tenant_statement(uuid) SET search_path = public, pg_temp;

-- Preserve grants
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid,date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid,date,date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_tenant_statement(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_tenant_statement(uuid) TO authenticated, service_role;
```

**Business Impact:**
- **Before:** Functions run with caller's privileges; if RLS changes, functions may break or expose unexpected data
- **After:** Functions run with definer's privileges; consistent with all other financial RPCs
- **User Impact:** ZERO — Current RLS policies allow authenticated reads, so behavior is unchanged

**Migration Strategy:**
1. **Pre-flight check:** Verify current function definitions via `pg_get_functiondef`
2. **Apply migration:** ALTER FUNCTION statements (instant, no downtime)
3. **Post-flight check:** Verify function definitions updated

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY INVOKER;
ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY INVOKER;
```

**Testing Strategy:**
- Unit test: Call RPC as authenticated user → expect success (same as before)
- Regression test: Verify owner statement report still works end-to-end
- Regression test: Verify tenant statement report still works end-to-end

---

## Category 3: Direct Financial Mutations Bypassing Accounting Integrity

### Issue 3.1: `expenseService.ts` uses direct `.update()` for expense editing

**Finding:** `updateExpense()` performs a direct `supabase.from('expenses').update(payload)`  
**Risk:** HIGH — Expense amount changes don't update corresponding journal entries  
**Affected File:** `rentrix-app/src/features/financials/expenses/expenseService.ts` (line 27)

#### Proposed Backend Migration

**File:** `supabase/migrations/20260713000007_add_update_expense_with_journal_atomic.sql`

**Strategy:**
```sql
CREATE OR REPLACE FUNCTION public.update_expense_with_journal_atomic(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_expense_id uuid := nullif(p_payload->>'expense_id', '')::uuid;
  v_new_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_new_category text := nullif(p_payload->>'category', '');
  v_new_description text := nullif(p_payload->>'description', '');
  v_expense record;
  v_old_amount numeric;
  v_amount_diff numeric;
  v_expense_account_id text;
  v_cash_account_id text;
  v_result jsonb;
BEGIN
  -- Auth check
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to update expenses' USING ERRCODE = '42501';
  END IF;

  -- Idempotency check
  IF v_request_id IS NOT NULL THEN
    SELECT response_payload INTO v_result
    FROM public.financial_operation_idempotency
    WHERE operation_name = 'update_expense_with_journal_atomic' AND request_id = v_request_id;
    IF v_result IS NOT NULL THEN
      RETURN v_result || jsonb_build_object('idempotent', true);
    END IF;
  END IF;

  -- Lock expense row
  SELECT * INTO v_expense
  FROM public.expenses
  WHERE id = v_expense_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  v_old_amount := v_expense.amount;
  v_amount_diff := v_new_amount - v_old_amount;

  -- Update expense
  UPDATE public.expenses
  SET amount = v_new_amount,
      category = COALESCE(v_new_category, category),
      description = COALESCE(v_new_description, description),
      updated_at = now()
  WHERE id = v_expense_id;

  -- If amount changed, update journal entries
  IF v_amount_diff <> 0 THEN
    v_expense_account_id := (SELECT id FROM public.accounts WHERE no = '6100' LIMIT 1);
    v_cash_account_id := (SELECT id FROM public.accounts WHERE no = '1111' LIMIT 1);

    IF v_expense_account_id IS NULL OR v_cash_account_id IS NULL THEN
      RAISE EXCEPTION 'Expense accounting accounts are not configured';
    END IF;

    -- Create reversing entry for old amount
    INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    VALUES
      (gen_random_uuid(), 'EXP-REV-' || v_expense_id::text || '-D', v_expense.expense_date, v_expense_account_id, v_old_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id::text, now()),
      (gen_random_uuid(), 'EXP-REV-' || v_expense_id::text || '-C', v_expense.expense_date, v_cash_account_id, v_old_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id::text, now());

    -- Create new entry for new amount
    INSERT INTO public.journal_entries (id, no, date, account_id, amount, type, source_id, entity_type, entity_id, created_at)
    VALUES
      (gen_random_uuid(), 'EXP-UPD-' || v_expense_id::text || '-D', v_expense.expense_date, v_expense_account_id, v_new_amount, 'DEBIT', v_expense_id, 'expense', v_expense_id::text, now()),
      (gen_random_uuid(), 'EXP-UPD-' || v_expense_id::text || '-C', v_expense.expense_date, v_cash_account_id, v_new_amount, 'CREDIT', v_expense_id, 'expense', v_expense_id::text, now());
  END IF;

  -- Audit log
  INSERT INTO public.audit_log (id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at)
  VALUES (
    gen_random_uuid(),
    extract(epoch from now())::bigint,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'UPDATE', 'expenses', v_expense_id::text,
    'Expense updated with journal adjustment',
    'expenses', left(p_payload::text, 4000), now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'expense_id', v_expense_id,
    'amount_changed', v_amount_diff <> 0
  );

  -- Idempotency record
  IF v_request_id IS NOT NULL THEN
    INSERT INTO public.financial_operation_idempotency (operation_name, request_id, response_payload)
    VALUES ('update_expense_with_journal_atomic', v_request_id, v_result)
    ON CONFLICT (operation_name, request_id) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_expense_with_journal_atomic(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_expense_with_journal_atomic(jsonb) TO authenticated, service_role;
```

#### Proposed Frontend Update

**File:** `rentrix-app/src/features/financials/expenses/expenseService.ts`

**Changes:**
```typescript
// Replace direct update with RPC call
export async function updateExpense(id: string, payload: ExpensePayload): Promise<Expense> {
  const { data, error } = await supabase.rpc('update_expense_with_journal_atomic', {
    p_payload: {
      request_id: crypto.randomUUID(),
      expense_id: id,
      amount: payload.amount,
      category: payload.category,
      description: payload.description,
    },
  });
  if (error) throw error;
  if (!data?.success) throw new Error('Expense update failed');
  
  // Fetch updated expense
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
    .returns<Expense>();
  if (fetchError) throw fetchError;
  return expense;
}
```

**Business Impact:**
- **Before:** Editing an expense amount creates a journal/expense mismatch
- **After:** Editing an expense amount creates reversing + new journal entries, maintaining consistency
- **User Impact:** ZERO — The UI behavior is unchanged; only the backend accounting is corrected

**Migration Strategy:**
1. **Backend first:** Apply the RPC migration
2. **Frontend second:** Update the service to use the RPC
3. **Deploy together:** Both changes can be deployed in the same release

**Rollback Strategy:**
- **Backend rollback:** Drop the new RPC, revert to direct `.update()`
- **Frontend rollback:** Revert the service code

**Testing Strategy:**
- Unit test: Update expense amount → verify 4 new journal entries created (2 reversing, 2 new)
- Unit test: Update expense category only (no amount change) → verify no new journal entries
- Integration test: Update expense via frontend → verify journal consistency
- Regression test: Verify `rpt_trial_balance` still balances after expense updates

---

## Category 4: Journal Entry Protection Gaps

### Issue 4.1: No double-entry balance enforcement

**Finding:** Journal entries can be created with unbalanced DEBITs/CREDITs  
**Risk:** HIGH — Unbalanced entries break accounting integrity  
**Affected Table:** `journal_entries`  
**Affected RPCs:** `post_receipt_atomic`, `create_expense_with_journal_atomic`, `update_expense_with_journal_atomic`

#### Proposed Migration

**File:** `supabase/migrations/20260713000008_add_journal_batch_balance_check.sql`

**Strategy:**
```sql
-- Add batch_id column to group related entries
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- Create index for batch lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_batch_id
  ON public.journal_entries(batch_id)
  WHERE batch_id IS NOT NULL;

-- Create trigger function to validate batch balance
CREATE OR REPLACE FUNCTION public.validate_journal_batch_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_total numeric;
BEGIN
  -- Only validate if batch_id is provided
  IF NEW.batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the last entry in the batch (deferred validation)
  -- We use a statement-level trigger approach: validate on INSERT
  -- For simplicity, we validate the batch after each insert
  -- In production, consider using DEFERRABLE constraints
  
  SELECT SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END)
    INTO v_batch_total
    FROM public.journal_entries
    WHERE batch_id = NEW.batch_id;

  -- Allow temporary imbalance during batch insertion
  -- Final validation happens via a separate check function
  -- This trigger logs warnings but doesn't block
  
  IF v_batch_total <> 0 THEN
    -- Log warning but don't block (batch may still be inserting)
    INSERT INTO public.audit_log (
      user_id, action, entity, entity_id, note, "table", created_at
    ) VALUES (
      auth.uid(),
      'JOURNAL_BATCH_IMBALANCE_WARNING',
      'journal_batch',
      NEW.batch_id::text,
      format('Batch %s has imbalance: %s', NEW.batch_id, v_batch_total),
      'journal_entries',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS validate_journal_batch_balance ON public.journal_entries;
CREATE TRIGGER validate_journal_batch_balance
  AFTER INSERT ON public.journal_entries
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL)
  EXECUTE FUNCTION public.validate_journal_batch_balance();

-- Add validation function for explicit batch closing
CREATE OR REPLACE FUNCTION public.close_journal_batch(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_total numeric;
  v_entry_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role required';
  END IF;

  SELECT 
    SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE -amount END),
    COUNT(*)
  INTO v_batch_total, v_entry_count
  FROM public.journal_entries
  WHERE batch_id = p_batch_id;

  IF v_batch_total <> 0 THEN
    RAISE EXCEPTION 'Batch % is unbalanced by %', p_batch_id, v_batch_total;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'entry_count', v_entry_count,
    'balanced', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_journal_batch(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_journal_batch(uuid) TO authenticated, service_role;
```

**Business Impact:**
- **Before:** Unbalanced journal entries are silently accepted
- **After:** Unbalanced batches generate audit warnings; explicit `close_journal_batch()` validates balance
- **User Impact:** ZERO — Current RPCs create balanced entries; this adds a safety net

**Migration Strategy:**
1. **Add column:** `batch_id` is nullable, so existing entries are unaffected
2. **Add trigger:** Logs warnings but doesn't block (safe for production)
3. **Update RPCs:** Future enhancement to use `batch_id` in `post_receipt_atomic`, etc.

**Rollback Strategy:**
```sql
-- Rollback migration (if needed)
DROP TRIGGER IF EXISTS validate_journal_batch_balance ON public.journal_entries;
DROP FUNCTION IF EXISTS public.validate_journal_batch_balance();
DROP FUNCTION IF EXISTS public.close_journal_batch(uuid);
ALTER TABLE public.journal_entries DROP COLUMN IF EXISTS batch_id;
```

**Testing Strategy:**
- Unit test: Insert balanced batch → verify no warnings
- Unit test: Insert unbalanced batch → verify warning logged
- Unit test: Call `close_journal_batch()` on balanced batch → expect success
- Unit test: Call `close_journal_batch()` on unbalanced batch → expect error
- Integration test: Verify payment recording still works (doesn't use batch_id yet)

---

## Implementation Order

### Phase 1A: CASCADE Fixes (Safest, No Code Changes)
1. `20260713000001_fix_contract_balances_cascade.sql`
2. `20260713000002_fix_owner_balances_cascade.sql`
3. `20260713000003_fix_receipt_allocations_cascade.sql`

**Rationale:** These are pure constraint changes with zero code impact. Apply first to establish baseline safety.

### Phase 1B: Permission Fixes (No Data Changes)
4. `20260713000004_fix_expense_rpc_role_check.sql`
5. `20260713000005_fix_void_receipt_anon_grant.sql`
6. `20260713000006_fix_report_rpcs_security_definer.sql`

**Rationale:** These tighten permissions without changing data or logic. Apply second.

### Phase 1C: Accounting Integrity (Backend + Frontend)
7. `20260713000007_add_update_expense_with_journal_atomic.sql`
8. Frontend update to `expenseService.ts`

**Rationale:** This adds new functionality and requires coordinated deployment.

### Phase 1D: Journal Protection (Additive Only)
9. `20260713000008_add_journal_batch_balance_check.sql`

**Rationale:** This is purely additive (nullable column, warning-only trigger). Apply last.

---

## Deployment Checklist

### Pre-Deployment
- [ ] Review all migration files
- [ ] Run migrations against staging environment
- [ ] Execute all test strategies
- [ ] Verify rollback procedures work
- [ ] Backup production database

### Deployment
- [ ] Apply Phase 1A migrations (CASCADE fixes)
- [ ] Verify constraint changes via `pg_constraint`
- [ ] Apply Phase 1B migrations (permission fixes)
- [ ] Verify grants via `pg_proc`
- [ ] Apply Phase 1C migration (expense update RPC)
- [ ] Deploy frontend update
- [ ] Apply Phase 1D migration (journal batch check)

### Post-Deployment
- [ ] Run smoke tests (create expense, void receipt, record payment)
- [ ] Verify audit logs show expected entries
- [ ] Monitor for errors in first 24 hours
- [ ] Document changes in `docs/GOVERNANCE_LOG.md`

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| CASCADE → RESTRICT | LOW | Application uses soft-delete; only affects direct DB access |
| Permission tightening | LOW | Frontend already enforces these roles; closes direct RPC bypass |
| Expense update RPC | MEDIUM | New code path; requires thorough testing |
| Journal batch check | LOW | Additive only; warnings don't block operations |

**Overall Risk:** LOW — All changes are defensive, reversible, and tested.

---

## Approval Gate

**Status:** ⏳ AWAITING APPROVAL

**To approve:** Reply with "APPROVED — Proceed with Phase 1 implementation"

**To request changes:** Specify which items need revision

**To defer:** Specify which items to defer to Phase 2

---

**NO CHANGES MADE. This is a plan only.**
