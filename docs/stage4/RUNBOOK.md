# Runbook — Bank CSV Import & Action System

## When to use this runbook

### Bank CSV Import
- User reports "الملف لا يستورد" or "مكرر" or "أرشفة لا تعمل"
- New bank format needs to be supported
- Import shows 0 accepted but file has rows
- Duplicate detection too aggressive or not catching duplicates
- Need to rollback a bad import batch

### Action System
- User sees "حذف نهائي" for soft-delete
- Confirm dialog closes on failure losing context
- Mobile header actions overflow off-screen at 320px
- Double-click creates duplicate records

---

## Prerequisites and Access Needed

- **Code**: `main` branch, `ux/stage4-actions-bank-import` history
- **Supabase**: access to project `nnggcnpcuomwfuupupwg` (prod) or staging
- **Permissions**: ADMIN role to test import, MANAGER to test archive
- **Tools**: pnpm 10.11.1, Node 24, Playwright for browser-smoke, psql or Supabase SQL editor
- **Files**:
  - Parser: `rentrix-app/src/lib/bankCsvParser.ts`
  - Service: `rentrix-app/src/features/financials/reconciliation/bankCsvImportService.ts`
  - Workflow UI: `bank-csv-import-workflow.tsx`
  - RPC: `supabase/migrations/20260805000001_bank_csv_import_hardening.sql`
  - Rollback: `supabase/rollback/20260805_rollback_bank_csv_import_hardening.sql`
  - Action header: `rentrix-app/src/components/layout/page-header-actions.tsx`

---

## Step-by-step Procedure

### Diagnose Bank Import Failure

1. **Collect info from user**
   - Filename, file size, encoding (check if BOM present via hex editor)
   - Screenshot of preview step (counts, column mapping, rejected rows table)
   - File fingerprint first 16 chars shown in preview

2. **Reproduce locally**
   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @workspace/rentrix exec vitest run src/lib/bankCsvParser.test.ts --reporter=verbose
   # Create a minimal CSV that reproduces issue
   ```

3. **Check column mapping**
   - Open file in VSCode, check first line headers
   - Does header match synonyms in `HEADER_SYNONYMS`? (Arabic/English list)
   - If duplicate headers: search for duplicate normalized header (case-insensitive)
   - If ambiguous mapping: same canonical field mapped twice → fix file or extend synonyms

4. **Check date/amount parsing**
   ```js
   // In browser console:
   import { parseBankCsv } from '@/lib/bankCsvParser';
   parseBankCsv(text, 'test.csv', text.length);
   // Look at rejectedRows[].reason
   ```
   - Date formats supported: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY (DD/MM preferred), ISO datetime
   - Amount: commas stripped, OMR text stripped, Arabic-Indic normalized, parentheses as negative, 0 rejected

5. **Check server logs**
   - Supabase Dashboard → Logs → Postgres
   - Search for `import_bank_statement_batch_atomic` errors
   - Common: `Bank account not found or not in your company` → check bank_accounts.company_id
   - `Invalid transaction_date` → fail-closed, file has invalid row, user must fix file (do not partially import)

6. **Check idempotency**
   ```sql
   SELECT id, reference, file_name, file_fingerprint, total_rows, accepted_rows, duplicate_rows, status
   FROM bank_statement_imports
   WHERE file_fingerprint = 'abc123...' AND company_id = current_company_id() AND deleted_at IS NULL;
   -- If exists, second upload returns existing batch with is_duplicate_file=true
   ```

7. **Check duplicate detection**
   ```sql
   -- Fingerprint for a row:
   SELECT md5(company_id::text || '|' || bank_account_id::text || '|' || transaction_date::text || '|' || to_char(amount,'FM999...0.000') || '|' || currency || '|' || lower(coalesce(reference,'')) || '|' || lower(description)) as fp
   FROM bank_statement_lines WHERE id = '...';

   -- Possible duplicates same date+amount different fingerprint:
   SELECT * FROM bank_statement_lines
   WHERE company_id = current_company_id() AND bank_account_id = 'uuid' AND transaction_date = '2026-01-01' AND amount = 100 AND deleted_at IS NULL;
   ```

### Fix Archive/Delete Wording

1. Search for ConfirmDialog titles containing "حذف" where backend is soft-delete:
   ```bash
   grep -R "softDelete\|deleted_at" rentrix-app/src --include="*.ts" -l
   grep -R "ConfirmDialog" rentrix-app/src --include="*.tsx" -A 3 | grep -i "حذف"
   ```
2. Ensure:
   - Title: `أرشفة ...؟` not `حذف ...؟` if backend sets deleted_at
   - Description: includes reference (slice 0,8 or BNK-...), human context, consequence "سجل أرشيفي يمكن استرجاعه"
   - confirmLabel: "تأكيد الأرشفة" not "حذف"
   - onConfirm uses `mutateAsync` + try/catch, only clears candidate on success
   - onOpenChange checks `!isPending` before clearing

### Fix Mobile Header Overflow

1. Check `page-header.tsx` uses `PageHeaderActions`, not old `max-w-[58vw] overflow-x-auto`
2. Verify at 320px:
   - Primary button visible, min-h-11 min-w-11
   - Secondary in overflow trigger `aria-label="إجراءات إضافية"` → BottomSheet
   - BottomSheet has `pb-[calc(1.5rem+env(safe-area-inset-bottom))]` and `max-h-[calc(var(--visual-viewport-height...))]`
3. Touch targets: `min-h-11` (44px) on all buttons in header actions
4. Icon-only: must have aria-label

---

## Rollback Steps

### Rollback Bank Import Feature (emergency only)

**Warning**: Forward-only discipline. Prefer corrective migration. Only rollback if RPC is causing prod errors and backup verified.

1. **Backup**
   ```sql
   -- In Supabase SQL editor, export counts:
   SELECT count(*) FROM bank_statement_imports WHERE deleted_at IS NULL;
   SELECT count(*) FROM bank_statement_lines WHERE deleted_at IS NULL;
   ```

2. **Run manual rollback script** (not auto-applied)
   ```bash
   # File: supabase/rollback/20260805_rollback_bank_csv_import_hardening.sql
   # Header must contain: Manual rollback for: supabase/migrations/20260805000001_bank_csv_import_hardening.sql
   psql $DATABASE_URL -f supabase/rollback/20260805_rollback_bank_csv_import_hardening.sql
   ```

   Script does:
   ```sql
   drop function if exists import_bank_statement_batch_atomic(jsonb);
   drop index if exists ux_bank_imports_company_fingerprint;
   drop index if exists idx_bank_imports_fingerprint;
   drop index if exists ux_bank_lines_company_fingerprint;
   drop index if exists idx_bank_lines_possible_dup;
   -- Keeps columns for safety
   ```

3. **Revert UI to old textarea** (if needed)
   - Checkout previous version of `bank-reconciliation-page.tsx` before this PR
   - Or set feature flag to hide new workflow

4. **Verify**
   - Old textarea import still works via `createBankStatementImportFromCsv`
   - No new imports via RPC possible (function dropped)
   - Existing batches remain with reference BNK-...

### Rollback Archive Wording

- Revert commits in `ux/stage4-actions-bank-import` that changed ConfirmDialog titles
- No DB change needed (wording only)
- Run `pnpm --filter @workspace/rentrix run typecheck && pnpm build && pnpm test`

---

## Escalation Path

- **Level 1**: Frontend dev — check parser, UI, tests
- **Level 2**: Backend dev — check RPC, indexes, RLS, company isolation, grants
- **Level 3**: DBA — check `bank_accounts.company_id`, `current_company_id()` JWT, Supabase logs, `pg_stat_activity` for long transactions
- **Level 4**: Product — if new bank format requires new synonyms or debit/credit logic, add to `HEADER_SYNONYMS` and tests, get approval for fail-closed vs partial import

**Slack**: #malik-dev, #malik-support
**On-call**: ADMIN role holder can test import via staging project

---

## Verification Checklist After Fix

- [ ] `pnpm typecheck` ✅
- [ ] `pnpm lint` ✅
- [ ] `pnpm build` ✅
- [ ] `pnpm --filter @workspace/rentrix exec vitest run` ✅ 307 files
- [ ] `node scripts/check-migration-rollback-hygiene.mjs --base origin/main` ✅
- [ ] Manual test at 320px, 390px, 430px, 1440px
- [ ] Bank import: select file → preview → valid/rejected counts → confirm → summary → lines appear as مستوردة
- [ ] Archive: confirm shows reference, not UUID, stays open on failure, no double submit
- [ ] Security: Company A cannot import into Company B bank account (test via RPC with wrong account id → 42501)
```

