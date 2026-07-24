# Rentrix — Phase 2 Audit & Report Recovery Verification
**Date**: 2026-07-24  
**Status**: Completed (Reports Recovered & Hardened; Core COA/Period Overlap registered as Blocker Gaps)  
**Lead Architect**: Arena Agent Mode (Lead Software Architect)

---

## 1. Executive Summary

This report delivers the technical verification and closing audit of **Phase 2 (Financial Integrity, Reports Recovery & Production Hardening)**. All 6 broken reporting RPCs have been completely recovered, audited, and tested under strict multi-company isolation boundaries. 

Per the user's directive, we do not claim partial or complete success on tasks that have architectural limitations. Instead, we **formally document the active blockers and gaps** (such as global Chart of Accounts uniqueness and partial period overlap) that are deferred to Phase 3/Hardening.

All tests are 100% green, and our forward-rollback fingerprints match byte-for-byte.

---

## 2. Root Cause Analysis & Technical Resolutions

We diagnosed and resolved several database-level defects in the 6 reporting RPCs:

### 2.1 `rpt_trial_balance` & `rpt_balance_sheet`
*   **Root Cause**: Threw a fatal Postgres `operator does not exist: text <= date` error when comparing the string-based `owner_settlements.date` with the date-based `p_as_of` parameter.
*   **Resolution**: 
    1. Adjusted date comparison: `AND public._safe_date(date) <= p_as_of` safely casts the text date field to a Postgres `date` type.
    2. **No Balancing Plug**: Completely removed the `retained earnings` balancing plug. Both reports now derive values directly from the `journal_entries` table. If there is an unbalanced journal entry, `is_balanced` will correctly evaluate to `false`.

### 2.2 `rpt_aged_receivables` & `rpt_overdue_invoices`
*   **Root Cause**: Redundant application of the `_safe_date()` function to `i.due_date` (which is already of type `date` in the database), triggering compilation errors.
*   **Resolution**: Stripped all redundant `_safe_date` wraps from native `date` columns.

### 2.3 `rpt_rent_roll`
*   **Root Cause**: Attempted to query non-existent columns `u.type` (from `units` table) and `c.deposit` (from `contracts` table).
*   **Resolution**: 
    1. Mapped the unit type column to the real descriptive unit name column: `coalesce(u.name, 'Apartment')`.
    2. Mapped the deposit column to calculate active deposits from the canonical `deposit_txs` table:
       ```sql
       'deposit', public._r3(coalesce((
          select sum(amount) from public.deposit_txs d 
          where d.contract_id = c.id and d.deleted_at is null
       ), 0))
       ```

### 2.4 `rpt_tenant_statement`
*   **Root Cause 1**: Joined properties table and selected `pr.name`, which does not exist (the actual title field is `title`).
*   **Root Cause 2**: Attempted to compare `c.id` (UUID) with `p_contract_id::text` (text), throwing a `uuid = text` type mismatch.
*   **Root Cause 3**: Called `left(r.date_time, 10)` on `r.date_time` (which is of type `timestamptz`).
*   **Root Cause 4**: Attempted to `UNION ALL` `i.due_date::text` (date) and `r.date_time` (text).
*   **Root Cause 5**: Concatenating a null `r.channel` made the entire receipt description null.
*   **Resolution**:
    1. Joined properties using `pr.title` instead of `pr.name`.
    2. Removed text casts and compared UUID parameters directly (`c.id = p_contract_id`).
    3. Cast timestamp to text before calling `left`: `left(r.date_time::text, 10)`.
    4. Cast invoice date to text: `i.due_date::text`.
    5. Wrapped `r.channel` in `coalesce` to prevent null propagation.
    6. **Canonical Source**: Used `public.payments` as the single-source-of-truth for collections rather than the view-backed `receipts` table.

---

## 3. Explicit Grants & Permissions

All 6 reporting functions have been explicitly hardened with strict execute permissions at the bottom of the migration file:
```sql
revoke all on function public.rpt_trial_balance(date) from public, anon;
grant execute on function public.rpt_trial_balance(date) to authenticated, service_role;

-- (Repeated for all 6 functions)
```
This restricts report execution strictly to authenticated sessions and service roles.

---

## 4. Formal Registry of Active Blockers & Gaps

We formally register the following items as **Unresolved Blockers** that cannot be closed in Phase 2 due to baseline architectural constraints, and must be addressed in Phase 3/Hardening:

### 4.1 Global Chart of Accounts Uniqueness Blocker
*   **The Issue**: The `accounts` table in the baseline schema defines `no text unique` as a globally unique constraint. This prevents multiple companies from each having their own account `1111` or `2000`. 
*   **Blocker Status**: Unresolved. Relaxing this to a composite unique constraint `unique (company_id, no)` requires a deep, database-wide migration of existing journal entries and foreign keys, which requires explicit product owner approval.

### 4.2 Owner Settlements Period Overlap Blocker
*   **The Issue**: The current constraint in `create_owner_settlement_draft_atomic` only prevents settlements with the **exact same** period. It fails to block partial overlaps (e.g., creating a settlement for `2026-07-15` to `2026-08-15` when `2026-07-01` to `2026-07-31` already exists).
*   **Blocker Status**: Unresolved. Adding a strict exclusion constraint using a `gist` date range overlap is queued for the next phase.

### 4.3 Leaked Password Protection
*   **The Issue**: Enabling Enforce Leaked Password Protection is controlled entirely within the Supabase Auth Console under `Auth -> Providers -> Email -> Enforce Leaked Password Protection`.
*   **Blocker Status**: Requires manual configuration on the live Supabase portal.

---

## 5. Verification & Tests Results

All test gates are **100% green and passing**:

*   **P2 Report Behavior & Privacy Tests**: `phase2-financial-reports-recovery.test.ts` passes with **8/8 green**.
*   **P2 Fingerprint Rollback Tests**: `phase2-forward-rollback.test.ts` passes with **1/1 green**, proving that running the rollback file restores the exact baseline fingerprint of all 6 reporting functions to the byte.
*   **P0 & P1 Isolation Tests**: `p0-multi-tenant-isolation.test.ts` and `p1-forward-rollback.test.ts` have been fully isolated from Phase 2 files and pass with **100% green**.
