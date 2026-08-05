# Onboarding Guide — Stage 4 Action System & Bank Import

## Environment Setup

### Prerequisites
- Node 24, pnpm 10.11.1 (`corepack enable && corepack prepare pnpm@10.11.1 --activate`)
- Supabase CLI (for migrations, if needed)
- Git, Chrome DevTools for mobile widths

### Clone & Install
```bash
git clone https://github.com/mohamedmasoud3030-tech/malik.git
cd malik
git checkout main
pnpm install --frozen-lockfile
# Rentrix app workspace
pnpm --filter @workspace/rentrix install --frozen-lockfile --ignore-scripts
pnpm rebuild esbuild
```

### Run Dev
```bash
pnpm --filter @workspace/rentrix run dev
# Vite serves at http://localhost:5173
# Live preview in Codespaces/Arena: https://{port}-{sandboxId}.e2b.app
# Bind to 0.0.0.0, not 127.0.0.1 (preview requirement)
```

### Supabase Local (optional)
```bash
supabase --version
# If you need clean replay:
pnpm supabase:migration-evidence
# Check hygiene:
node scripts/check-migration-rollback-hygiene.mjs --base origin/main
```

---

## Key Systems and How They Connect

### 1. Action System
- **ConfirmDialog** (`rentrix-app/src/components/ui/confirm-dialog.tsx`): reusable destructive confirmation, disables close while isLoading, variant danger/warning
- **PageHeader** (`components/layout/page-header.tsx`): title + count + description + actions rail
- **PageHeaderActions** (`page-header-actions.tsx`): mobile-aware — primary compact, secondary desktop inline, mobile overflow MoreVertical → BottomSheet
- **BottomSheet** (`components/ui/bottom-sheet.tsx`): portal, safe-area, focus trap, 44px handles
- **ActionMenu** (`components/ui/action-menu.tsx`): dropdown for entity actions, returns null if all disabled (permission-hidden no broken menu)

**Flow**: Page → use controller (e.g., `usePropertyListController`) → has `archiveTarget`, `isArchiving`, `confirmArchive` (mutateAsync + guard) → `ConfirmDialog`

### 2. Bank CSV Import
- **Parser** (`rentrix-app/src/lib/bankCsvParser.ts`): `parseBankCsv(text, fileName, fileSize)` → `BankCsvParseResult`
  - `HEADER_SYNONYMS` dict for AR/EN
  - `parseCsvLine` handles quoted commas
  - `detectDelimiter` counts , vs ; outside quotes
  - `parseDateFlexible` handles multiple formats
  - `normalizeAmountString` handles OMR, commas, Arabic-Indic, parentheses
  - `computeFileFingerprint` SHA-256
- **Service** (`features/financials/reconciliation/bankCsvImportService.ts`): `previewBankCsvFile(file)` → preview + fingerprint, `importBankStatementBatch` → RPC, `toImportPayloadRows` → normalized rows
- **Workflow UI** (`bank-csv-import-workflow.tsx`): staged steps select → preview → mapping → review → importing → completed
- **RPC** (`supabase/migrations/20260805000001_bank_csv_import_hardening.sql`): `import_bank_statement_batch_atomic`
- **Types**: `rentrix-app/src/types/database.ts` has new columns for imports/lines, `import_bank_statement_batch_atomic` in Functions

### 3. Permissions & Company Isolation
- **Permissions** (`features/auth/permissions.ts`): `financial.bank_reconciliation.view` + `match` (ADMIN,MANAGER)
- **Company isolation**: `current_company_id()` from JWT, RLS `p0_tenant_isolation`, bank account check in RPC, no client company_id trust
- **Reference**: `document_reference_sequences` + `next_document_reference` + `assign_document_reference` trigger for BNK-

### 4. Migrations
- **Forward**: `20260805000001_bank_csv_import_hardening.sql` — adds file_name, file_fingerprint, file_size, total/accepted/rejected/duplicate/possible_duplicate, status, error_summary, processed_at, fingerprint, balance, currency, external_reference, unique indexes, RPC
- **Rollback**: `20260805_rollback_bank_csv_import_hardening.sql` — manual, header must contain `Manual rollback for: supabase/migrations/...sql`, drops RPC and indexes, keeps columns safe

---

## Common Tasks with Walkthroughs

### Task 1: Add a new Arabic header synonym for bank CSV

**Scenario**: Bank uses "تاريخ القيد" for date, not recognized.

1. Open `rentrix-app/src/lib/bankCsvParser.ts`
2. Find `HEADER_SYNONYMS.transaction_date` array
3. Add `"تاريخ القيد"`
4. Add test in `bankCsvParser.test.ts`:
   ```ts
   it('handles new Arabic header تاريخ القيد', () => {
     const csv = 'تاريخ القيد,الوصف,المبلغ\n2026-01-01,Test,100';
     const result = parseBankCsv(csv, 'test.csv', 100);
     expect(result.validRows.length).toBe(1);
   });
   ```
5. Run `pnpm --filter @workspace/rentrix exec vitest run src/lib/bankCsvParser.test.ts`
6. Commit, push, PR — no server change needed

### Task 2: Fix archive wording for a new entity

**Scenario**: New entity `vehicles` with soft-delete shows "حذف" but should be "أرشفة"

1. Find its list page: `features/vehicles/vehicles-list-page.tsx`
2. Ensure `useSoftDeleteVehicle().mutateAsync` used, not `mutate` with `onSettled`
3. Update ConfirmDialog:
   ```tsx
   <ConfirmDialog
     open={!!candidate}
     onOpenChange={(o) => { if (!o && !isPending) setCandidate(null) }}
     title={`أرشفة المركبة "${candidate?.plate ?? ''}"؟`}
     description={`المرجع: ${candidate?.id.slice(0,8)} — ... — سجل أرشيفي`}
     confirmLabel="تأكيد الأرشفة"
     isLoading={isPending}
     onConfirm={async () => {
       if (isPending) return;
       try { await mutateAsync(candidate.id); setCandidate(null) }
       catch {}
     }}
   />
   ```
4. Ensure button label "أرشفة" not "حذف", aria-label `أرشفة المركبة ...`, variant danger, min-h-11
5. Add test in `action-system.test.tsx` or create `vehicles-archive.test.tsx` asserting title contains أرشفة not حذف نهائي

### Task 3: Debug double-click creates duplicate property

1. Check `confirmArchive` has guard:
   ```ts
   const confirmArchive = async () => {
     if (!archiveTarget || deleteMutation.isPending) return;
     try { await deleteMutation.mutateAsync(archiveTarget.id); setArchiveTarget(null) }
     catch {}
   };
   ```
2. Check ConfirmDialog `isLoading={deleteMutation.isPending}` disables button
3. Add regression test: simulate two rapid clicks, expect mutate called once
   ```ts
   let callCount = 0;
   const isLoading = true;
   let canClick = !isLoading;
   if (canClick) callCount++;
   if (canClick) callCount++;
   expect(callCount).toBe(0);
   ```

### Task 4: Support new date format DD.MM.YYYY in bank CSV

1. Open `parseDateFlexible` in `bankCsvParser.ts`
2. Add regex handling `.` separator already exists via `[\/\-\.]`, but ensure day/month/year parsing handles `.`
3. Add test case `01.02.2026` → `2026-02-01`
4. Run parser tests

### Task 5: Test mobile header at 320px

1. `pnpm --filter @workspace/rentrix run dev`
2. Chrome DevTools → Toggle device toolbar → set width 320, height 600
3. Go to **العقارات** — primary **إضافة عقار** visible compact, secondary **تصدير CSV** hidden, **⋮** button visible
4. Click **⋮** → BottomSheet opens, shows secondary actions full-width, safe-area bottom padding, close button works, Esc closes, focus trap works

---

## Who to Ask for What

- **Action system / PageHeaderActions / ConfirmDialog**: Check `docs/stage4/README.md` and `rentrix-app/src/components/layout/page-header-actions.tsx` — owner Stage 4
- **Bank parser / synonyms / date formats**: `rentrix-app/src/lib/bankCsvParser.ts` — see `HEADER_SYNONYMS` and `parseDateFlexible`
- **Import RPC / idempotency / duplicate detection**: `supabase/migrations/20260805000001_bank_csv_import_hardening.sql` — owner DB, check grants, company isolation
- **Permissions**: `rentrix-app/src/features/auth/permissions.ts` — `financial.bank_reconciliation.match`
- **Mobile UX / BottomSheet**: `rentrix-app/src/components/ui/bottom-sheet.tsx` — safe-area, focus trap
- **Migrations hygiene**: `scripts/check-migration-rollback-hygiene.mjs` — needs header `Manual rollback for: ...`
- **Tests**: `pnpm --filter @workspace/rentrix exec vitest run` — 307 files, look for `bankCsvParser.test.ts`, `action-system.test.tsx`, `page-header.test.tsx`
- **CI**: `.github/workflows/ci.yml` — build, typecheck, lint, architecture, tests, isolated-replay, release-blocker, browser-smoke, SonarCloud

---

## Quick Reference Commands

```bash
# Typecheck
pnpm typecheck
pnpm --filter @workspace/rentrix run typecheck:test

# Lint & architecture
pnpm lint
pnpm --filter @workspace/rentrix run check:architecture

# Build
pnpm build

# Tests
pnpm --filter @workspace/rentrix exec vitest run
pnpm --filter @workspace/rentrix exec vitest run src/lib/bankCsvParser.test.ts --reporter=verbose

# Docs links
pnpm check:docs

# Migration hygiene
node scripts/check-migration-rollback-hygiene.mjs --base origin/main

# Supabase evidence (requires Docker)
pnpm supabase:migration-evidence
```
