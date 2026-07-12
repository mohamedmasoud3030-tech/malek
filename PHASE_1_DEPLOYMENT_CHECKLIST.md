# Phase 1: Financial Safety Lock — Deployment Checklist

**Date:** 2026-07-13  
**Estimated deployment time:** 30 minutes  
**Deployment window:** Low-traffic period recommended  

---

## Pre-Deployment

- [ ] **Database backup completed**
  ```bash
  pg_dump -Fc -f rentrix_backup_$(date +%Y%m%d_%H%M%S).dump your_database
  ```
- [ ] **Staging environment tested** — all 38 tests passed
- [ ] **No active financial transactions** during deployment window
- [ ] **Team notified** of deployment window
- [ ] **Rollback plan reviewed** by team

---

## Phase 1A: CASCADE Fixes (~5 minutes)

- [ ] Apply `20260713000001_fix_contract_balances_cascade.sql`
- [ ] Verify: `contract_balances.contract_id` FK is RESTRICT
  ```sql
  SELECT confdeltype FROM pg_constraint 
  WHERE conname = 'contract_balances_contract_id_fkey';
  -- Expected: 'r'
  ```
- [ ] Apply `20260713000002_fix_owner_balances_cascade.sql`
- [ ] Verify: `owner_balances.owner_id` FK is RESTRICT
- [ ] Apply `20260713000003_fix_receipt_allocations_cascade.sql`
- [ ] Verify: `receipt_allocations.receipt_id` FK is RESTRICT
- [ ] **Phase 1A checkpoint:** All 3 constraints changed to RESTRICT ✅

---

## Phase 1B: Permission Fixes (~5 minutes)

- [ ] Apply `20260713000004_fix_expense_rpc_role_check.sql`
- [ ] Verify: `create_expense_with_journal_atomic` uses `is_admin_or_manager`
  ```sql
  SELECT prosrc FROM pg_proc 
  WHERE proname = 'create_expense_with_journal_atomic'
  AND prosrc LIKE '%is_admin_or_manager%';
  ```
- [ ] Apply `20260713000005_fix_void_receipt_anon_grant.sql`
- [ ] Verify: `anon` cannot execute `void_receipt_atomic(jsonb)`
  ```sql
  SELECT has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'execute');
  -- Expected: false
  ```
- [ ] Apply `20260713000006_fix_report_rpcs_security_definer.sql`
- [ ] Verify: Report RPCs are SECURITY DEFINER
- [ ] **Phase 1B checkpoint:** All permissions tightened ✅

---

## Phase 1C: Accounting Integrity (~10 minutes)

### Backend
- [ ] Apply `20260713000007_add_update_expense_with_journal_atomic.sql`
- [ ] Verify: Function exists
  ```sql
  SELECT proname FROM pg_proc 
  WHERE proname = 'update_expense_with_journal_atomic';
  ```
- [ ] Test: Create expense via RPC → verify success
- [ ] Test: Update expense amount via RPC → verify journal entries created

### Frontend
- [ ] Build frontend with updated `expenseService.ts`
  ```bash
  cd rentrix-app && pnpm build
  ```
- [ ] Deploy frontend to production
- [ ] Test: Update expense via UI → verify success
- [ ] Test: Verify journal entries created on amount change
- [ ] **Phase 1C checkpoint:** Expense updates maintain journal consistency ✅

---

## Phase 1D: Journal Protection (~5 minutes)

- [ ] Apply `20260713000008_add_journal_batch_balance_check.sql`
- [ ] Verify: `batch_id` column exists
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'journal_entries' AND column_name = 'batch_id';
  ```
- [ ] Verify: Trigger exists
  ```sql
  SELECT tgname FROM pg_trigger 
  WHERE tgname = 'validate_journal_batch_balance';
  ```
- [ ] Verify: `close_journal_batch` function exists
- [ ] **Phase 1D checkpoint:** Journal batch protection active ✅

---

## Post-Deployment Verification

### Immediate (within 1 hour)
- [ ] Run smoke tests:
  - [ ] Create expense → success
  - [ ] Update expense amount → success, journal entries created
  - [ ] Record payment → success
  - [ ] Void receipt → success
  - [ ] Generate owner statement → success
- [ ] Check application logs for errors
- [ ] Check `audit_log` for unexpected entries

### First 24 Hours
- [ ] Monitor `audit_log` for `JOURNAL_BATCH_IMBALANCE_WARNING`
- [ ] Monitor application error rates
- [ ] Verify expense update success rate = 100%
- [ ] Verify payment recording success rate = 100%
- [ ] Verify void receipt success rate = 100%
- [ ] Check that no USER-role users created/updated expenses

### First Week
- [ ] Review all financial reports for accuracy
- [ ] Verify trial balance still balances
- [ ] Check owner/tenant statements generate correctly
- [ ] Review audit log for any anomalies

---

## Rollback Decision Points

| Phase | Rollback If | Action |
|-------|-------------|--------|
| 1A | Any constraint change fails | Roll back that specific constraint |
| 1B | Expense creation breaks for MANAGER/ADMIN | Roll back role check |
| 1C | Expense updates fail or create wrong journal entries | Roll back RPC + frontend |
| 1D | Trigger causes performance issues | Drop trigger (column can stay) |

---

## Documentation Updates

- [ ] Update `docs/GOVERNANCE_LOG.md` with deployment record
- [ ] Update `docs/CURRENT_STATE.md` with new constraints and RPCs
- [ ] Update `docs/DOMAIN.md` with journal batch documentation
- [ ] Notify team of completed deployment

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | | | ⬜ |
| DBA | | | ⬜ |
| QA | | | ⬜ |
| Product Owner | | | ⬜ |

---

**Status: ⏳ AWAITING DEPLOYMENT**
