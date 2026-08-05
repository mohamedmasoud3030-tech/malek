# Stage 4 — Action System, Archive/Delete Semantics, Mobile Actions, Bank CSV Import

> **What this is:** The final UI/UX remediation stage that unifies destructive action wording, fixes double-submission, makes mobile headers overflow-safe, and completes the bank statement CSV import from a textarea paste into a staged, idempotent, auditable workflow.

> **Why it exists:** Previous audits (UX-022, 037, 042, 047, 048, 066, 067) found:
> - "حذف" used for soft-delete (deleted_at) — misleading, no irreversible warning
> - Confirm dialogs showed raw UUID, closed on failure losing context
> - Mobile header overflowed at 320px, primary hidden, destructive beside primary
> - Bank import was textarea paste, no preview, no duplicate detection, no file fingerprint, direct table insert bypassing company isolation

This stage fixes all without introducing accounting Stage 4 behavior.

---

## Quick Start (<5 min)

### 1. Run locally
```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/rentrix run dev
# App at http://localhost:5173, preview at https://{port}-{sandboxId}.e2b.app
```

### 2. Test bank import
1. Go to **المالية → مطابقة البنك**
2. Click **استيراد CSV**
3. Select `rentrix-app/e2e/fixtures/bank-sample.csv` (or any CSV)
4. Preview shows: filename, encoding (UTF-8/BOM), delimiter (comma/semicolon), total/valid/rejected/duplicate counts, column mapping, first 10 normalized rows, rejected reasons
5. Confirm → see summary with **BNK-YYYY-NNNNNN** reference, counts, fingerprint
6. Lines appear as **مستوردة** (unmatched) in table, ready for manual matching

### 3. Verify action semantics
- Open **العقارات** → click **أرشفة** on a card
- Dialog title: `أرشفة العقار "فيلا النخيل"؟` (not حذف نهائي)
- Description includes: المرجع (CNT-...), العنوان, الحالة, consequence "سجل أرشيفي"
- Confirm button disabled while pending, dialog stays open if network fails
- Double-click rapidly → only one mutation (guarded by isPending)

### 4. Mobile check
- Resize to 320px, 390px, 430px (Chrome DevTools)
- Header: primary **إضافة عقار** always visible compact (44px)
- Secondary **تصدير CSV**, **طباعة** moves into **⋮ المزيد** bottom sheet, stays within viewport, safe-area padding preserved

---

## Configuration and Usage

### Environment
- No new env vars. Uses existing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Permissions: `financial.bank_reconciliation.view` + `match` (ADMIN/MANAGER only)
- Company isolation via `current_company_id()` from JWT, not client payload

### Components
```tsx
// Page header — mobile aware
<PageHeader
  title="العقارات"
  count={42}
  primaryAction={<Button>إضافة عقار</Button>}
  secondaryActions={<><Button>تصدير CSV</Button><Button>طباعة</Button></>}
/>
// Internally uses PageHeaderActions:
// - desktop: secondary inline
// - mobile: overflow trigger + BottomSheet

// Confirm dialog — archive wording
<ConfirmDialog
  open={!!candidate}
  onOpenChange={(o) => { if (!o && !isPending) setCandidate(null) }}
  title={`أرشفة العقار "${title}"؟`}
  description={`المرجع: ${reference} — ${address} — يمكن استرجاعه`}
  confirmLabel="تأكيد الأرشفة"
  isLoading={isPending}
  onConfirm={async () => {
    if (isPending) return;
    try { await mutateAsync(id); setCandidate(null) }
    catch { /* keep open */ }
  }}
/>

// Bank import workflow
<BankCsvImportWorkflow
  open={open}
  onOpenChange={setOpen}
  defaultBankAccountId={accountId}
  canManage={canManage}
  onCompleted={(result) => {
    // result: {id, reference, file_name, total_rows, accepted_rows, duplicate_rows, ...}
    refetchLines();
  }}
/>
```

### CSV Format Supported
- **Encoding**: UTF-8, UTF-8 BOM
- **Delimiter**: `,` or `;` auto-detected outside quotes, confidence high/low/fallback
- **Headers AR**: التاريخ, المبلغ, الوصف, المرجع, الرصيد, العملة, مدين, دائن
- **Headers EN**: date, amount, description, reference, balance, currency, debit, credit, transaction_date, etc.
- **Quoted**: `"Test, with comma"` → single cell
- **OMR**: 3 decimals, commas stripped, `OMR` text stripped, Arabic-Indic digits normalized, parentheses as negative
- **Dates**: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY (Omani DD/MM preferred), ISO datetime
- **Blank rows**: skipped
- **Errors**: invalid date/amount → rejected with reason, duplicate header → error, missing mandatory → fail-closed

---

## Contributing Guide

### Principles for new actions
1. **Wording matches backend**: `deleted_at` → "أرشفة", `status=cancelled` → "إلغاء", `status=ignored` → "تجاهل". Only use "حذف نهائي" when row is truly deleted irreversibly and you must state "لا يمكن التراجع".
2. **Business reference first**: Never UUID as main label. Use `reference` (CNT-/INV-/RCT-/BNK-...) + human context: tenant/owner/property/unit, amount+currency, date, status.
3. **Double-submit guard**: `if (isPending) return;` + disabled button + `mutateAsync` + only close on success.
4. **Hierarchy**: 1 primary, secondary grouped, destructive `variant="danger"` separated, disabled with title explaining why, permission-hidden returns null (ActionMenu).
5. **Mobile**: Primary compact always visible, secondary into overflow bottom sheet, touch target 44px, safe-area, menu within viewport.

### Adding a new CSV format
- Extend `HEADER_SYNONYMS` in `rentrix-app/src/lib/bankCsvParser.ts`
- Add case to `parseBankCsv` for new date format in `parseDateFlexible`
- Add test in `bankCsvParser.test.ts`
- No server change needed — server accepts normalized rows

### Migration hygiene
- Forward-only migration: `supabase/migrations/20260805000001_*.sql`
- Rollback manual: `supabase/rollback/20260805_*.sql` with header `-- Manual rollback for: supabase/migrations/...sql`
- No `MAX()+1`, use `next_document_reference` trigger for BNK-
- Grants: revoke public, anon; grant authenticated, service_role
- `search_path = public, pg_temp` pinned

Run gates before push:
```bash
pnpm typecheck
pnpm --filter @workspace/rentrix run typecheck:test
pnpm lint
pnpm build
pnpm --filter @workspace/rentrix run check:architecture
pnpm check:docs
pnpm --filter @workspace/rentrix exec vitest run
node scripts/check-migration-rollback-hygiene.mjs --base origin/main
```

### Who to ask
- **Action system**: see `rentrix-app/src/components/layout/page-header-actions.tsx`
- **Bank parser**: `rentrix-app/src/lib/bankCsvParser.ts`
- **Import RPC**: `supabase/migrations/20260805000001_bank_csv_import_hardening.sql`
- **Permissions**: `rentrix-app/src/features/auth/permissions.ts`
