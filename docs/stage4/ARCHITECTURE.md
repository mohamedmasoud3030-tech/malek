# Architecture Doc — Stage 4 Action System & Bank CSV Import

## Context and Goals

**Context**: Rentrix (MALEK) is Arabic RTL property management for single office, stack React+TS+Tailwind+shadcn/Radix+Supabase, 3 roles (ADMIN,MANAGER,USER), 26 permissions. Previous stages:
- PR #1337 canonical MALEK brand
- PR #1338 hub navigation consolidation + Reports ?section= URL state
- PR #1339 /financials IA cleanup (operational summary, not duplicate directory)
- PR #1340 server-generated business references (CNT-/INV-/RCT-/EXP-/MNT-/AGR-/STL-/DEP-/UTL-/BNK-)

**Goals Stage 4**:
- Unify action system (primary/secondary/destructive hierarchy, permission-hidden no broken menus)
- Correct archive/delete semantics (soft-delete wording = أرشفة, not permanent, business reference not UUID, double-submit guard, preserve context on failure)
- Mobile header reachable at 320/390/430 without horizontal overflow
- Complete bank CSV import staged workflow with preview, mapping, idempotency, duplicate detection, company isolation, no accounting posting

**Non-goals**: No accounting Stage 4 (no OWNER_IS_CREDITOR, OFFICE_IS_CREDITOR, rent posting, settlement, VAT, periods, reversals, backfill)

---

## High-level Design with Diagrams

### Action System

```
User → PageHeader → PageHeaderActions → [Primary] + [Secondary Desktop] + [Overflow Trigger Mobile] → BottomSheet

PageHeaderActions
  ├── data-primary-action (always visible, compact, min-h-11)
  ├── data-secondary-actions-desktop (hidden sm:flex, aria-label="إجراءات ثانوية")
  └── data-secondary-overflow-trigger (sm:hidden, MoreVertical, aria-label="إجراءات إضافية", aria-haspopup dialog)
      └── BottomSheet (portal, safe-area, max-h var(--visual-viewport-height), focus trap)
          └── data-secondary-actions-mobile (grid, full-width buttons min-h-12)

ConfirmDialog
  ├── title: business ref + human context
  ├── description: ref slice, owner/property/unit, amount+currency, date, status, consequence
  ├── confirmLabel: "تأكيد الأرشفة" / "تأكيد الإلغاء" / "تجاهل الحركة"
  ├── isLoading: disables buttons, prevents Esc/outside close
  └── onConfirm: guard if isPending return, mutateAsync try/catch, only clear candidate on success
```

**Touch target**: All header buttons min-h-11 (44px), mobile grid min-h-12
**Destructive**: variant="danger", separated from primary by being in secondary group
**Permission-hidden**: ActionMenu returns null if all disabled, PageHeaderActions hides overflow trigger if no secondary

### Bank CSV Import

```
[1] File Input (5MB max, .csv)
  ↓ File.text() + computeFileFingerprint SHA-256
[2] parseBankCsv(text, fileName, fileSize)
  ├── strip BOM
  ├── detect delimiter (count , vs ; outside quotes, confidence high/low/fallback)
  ├── parse lines with quoted handling (parseCsvLine)
  ├── header detection: any cell matches HEADER_SYNONYMS → hasHeader
  ├── duplicate header check (normalized case-insensitive)
  ├── column mapping: field → index via matchHeaderToField (AR/EN synonyms)
  ├── missing mandatory: date + amount (or debit+credit)
  ├── for each data row:
  │   ├── parseDateFlexible (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, ISO)
  │   ├── normalizeAmount (strip OMR, commas, Arabic-Indic, parentheses negative, 3-dec)
  │   ├── debit/credit normalization (credit - debit, debit negative)
  │   ├── fingerprint = hash(date|amount|currency|ref lower|desc lower) for intra-file dup
  │   ├── validRows / rejectedRows (reason, rowNumber, raw, field)
  │   └── previewRows first 10
  └── BankCsvParseResult {fileName, fileSize, encoding, delimiter, confidence, totalRows, headers, columnMapping, mappingAmbiguous, missingMandatory, validRows, rejectedRows, duplicateWithinFile, previewRows, errorSummary}

[3] Preview UI (no DB write)
  ├── filename, encoding, delimiter, counts, fingerprint first16
  ├── headers chips, mapping field←header
  ├── normalized preview table
  └── rejected table (rowNumber, reason, raw)

[4] User confirms → toImportPayloadRows → importBankStatementBatch RPC

[5] Server RPC import_bank_statement_batch_atomic(payload jsonb)
  ├── auth: is_app_user + is_admin_or_manager + current_company_id()
  ├── validate bank_account_id belongs to company, exists
  ├── idempotency: SELECT existing WHERE company_id=v AND file_fingerprint=p AND deleted_at null → return existing
  ├── preload existing_fps array_agg(fingerprint) for account
  ├── first pass validate all rows (date cast, amount non-zero) fail-closed exception if invalid
  ├── fingerprint = md5(company|account|date|amount(3dec)|currency|ref lower|desc lower)
  ├── counts: accepted, duplicate (intra-file or DB exact), possible (same date+amount different fp)
  ├── insert import batch with status completed/duplicate, error_summary jsonb, reference via trigger BNK-
  ├── on unique_violation (race) → return existing
  ├── second pass insert lines ON CONFLICT (company_id, fingerprint) DO NOTHING
  └── return jsonb {id, reference, file_name, fingerprint, total, accepted, rejected, duplicate, possible_duplicate, status, is_duplicate_file}

[6] Completion summary → refetch lines, set filter bankAccountId, navigate to reconciliation (already there)

[7] Reconciliation: lines status unmatched → user manually matches to payment/receipt/expense via process_bank_reconciliation_match_atomic (existing), language مستوردة → اقتراح مطابقة → تمت المراجعة يدوياً → مطابقة (never auto-reconciled unless genuinely matched)
```

---

## Key Decisions and Trade-offs

### Decision 1: Archive wording = أرشفة for deleted_at
- **Context**: Properties, units, people, contracts, docs, etc. set deleted_at, not hard deleted
- **Decision**: UI must say أرشفة/إلغاء/تجاهل, not حذف نهائي, and description must say "سجل أرشيفي يمكن استرجاعه"
- **Trade-off**: Need to update many ConfirmDialog titles, but preserves audit safety, matches security gate that forbids anon delete
- **Alternative rejected**: Add permanent delete for financial records to match UI label — would violate audit safety

### Decision 2: PageHeaderActions with BottomSheet overflow, not scroll
- **Context**: Old header used max-w 58vw + overflow-x-auto, broke at 320px, primary could hide
- **Decision**: Primary always visible compact, secondary hidden on mobile into MoreVertical → BottomSheet, safe-area, menu within viewport, touch 44px
- **Trade-off**: Extra component, BottomSheet portal, but better a11y, no horizontal scroll, destructive separated
- **Alternative rejected**: Keep scroll rail — fails 320px requirement, horizontal overflow breaks RTL

### Decision 3: Fail-closed CSV import, not partial
- **Context**: Spec says if some rows invalid, default rejecting batch requiring correction, partial only if repo already supports
- **Decision**: Parse all rows, if any invalid date/amount in required fields, reject entire file in preview (validRows may be subset) and server validation raises exception before any write
- **Trade-off**: User must fix file, but prevents silent partial success and accounting confusion
- **Alternative rejected**: Import valid rows only — would be partial without explicit product behavior, violates spec

### Decision 4: Fingerprint includes all fields for exact duplicate, not amount+date alone
- **Context**: Different legitimate transactions same amount/date must not collapse
- **Decision**: Fingerprint = md5(company|account|date|amount 3dec|currency|ref lower|desc lower). Exact duplicate = same fingerprint. Possible duplicate = same date+amount different fingerprint, flagged but inserted
- **Trade-off**: More storage, need unique index, but safe against false collapse
- **Alternative rejected**: Description alone or amount+date alone — too aggressive

### Decision 5: File fingerprint SHA-256 for idempotency
- **Context**: Same file should not create duplicate transactions
- **Decision**: Client computes SHA-256 via SubtleCrypto, server stores file_fingerprint with unique index (company_id, fingerprint) WHERE deleted_at null, returns existing batch on retry
- **Trade-off**: Need crypto, fallback hash, but deterministic, safe retry, concurrent import handled via unique_violation catch
- **Alternative rejected**: No fingerprint → duplicate batches; MAX+1 reference → race

### Decision 6: No accounting posting in import
- **Context**: Strict accounting boundary, bank import may create operational import and reconciliation records only
- **Decision**: RPC only inserts into bank_statement_imports/lines, no journal_entries, language "مستوردة" not "تمت المطابقة تلقائياً"
- **Trade-off**: User must manually match, but avoids inventing accounting entries
- **Alternative rejected**: Auto-reconcile or auto-post — violates boundary

---

## Data Flow and Integration Points

### Action System Data Flow
- **AuthZ**: `useAuth()` → `authorization` → `canAccess(permission)` → `canManageReconciliation`
- **Mutations**: `useSoftDeleteProperty().mutateAsync(id)` → `softDeleteProperty` → `supabase.from('properties').update({deleted_at})` or RPC `soft_delete_contract_atomic`
- **ConfirmDialog**: receives `isLoading = mutation.isPending`, disables close, guard early return, only clears candidate on success
- **PageHeader**: receives `primaryAction`, `secondaryActions` ReactNodes, passes to `PageHeaderActions` which handles responsive

### Bank Import Data Flow
- **File System**: User selects File → `File.text()` → `computeFileFingerprint` (SHA-256) → `parseBankCsv` (synchronous, no DB)
- **Preview**: `BankCsvParseResult` → UI shows counts, mapping, preview, rejected
- **RPC**: `toImportPayloadRows` → normalized rows → `supabase.rpc('import_bank_statement_batch_atomic', {payload})`
- **DB**: `bank_accounts` (check company), `bank_statement_imports` (unique fingerprint), `bank_statement_lines` (unique company+fingerprint, index date+amount for possible dup), `document_reference_sequences` (trigger for BNK- ref)
- **Reconciliation**: `listBankStatementLines` → `summarizeReconciliation` → `BankStatementLinesTable` → `matchBankStatementLine` → `process_bank_reconciliation_match_atomic` (existing) → status matched

### Integration Points
- **Permissions**: `financialOperationPermissions.matchBankReconciliation` used for import button disabled + RPC is_admin_or_manager check
- **Company isolation**: `current_company_id()` from JWT, RLS `p0_tenant_isolation`, bank account check
- **Reference generation**: `document_reference_sequences` + `next_document_reference` atomic INSERT..ON CONFLICT + `assign_document_reference` BEFORE INSERT trigger
- **Supabase**: `supabase.rpc`, `supabase.from().select().is('deleted_at', null)`, `fetchAllRows` with deterministic order `transaction_date DESC, id DESC`
- **UI primitives**: `EntityForm.Overlay` (BottomSheet on mobile), `ConfirmDialog`, `BottomSheet`, `KpiCard`, `EntityTable`, `MobileCard`

### Diagrams (text)

```
Component Dependencies:
PageHeader -> PageHeaderActions -> BottomSheet
BankReconciliationWorkspace -> useBankReconciliationController -> useBankAccounts, useBankStatementLines, useCreateBankStatementLine, useImportBankStatementCsv (old), useMatchBankStatementLine, useIgnoreBankStatementLine
BankReconciliationWorkspace -> BankCsvImportWorkflow -> useBankAccounts + bankCsvImportService + bankCsvParser
bankCsvImportService -> supabase.rpc(import_bank_statement_batch_atomic) -> DB
bankCsvParser -> HEADER_SYNONYMS + parseDateFlexible + normalizeAmountString + computeFileFingerprint
```

---

## Non-functional Considerations

- **Performance**: Parser O(n) with O(n^2) duplicate check within file acceptable for <10k rows; DB existence check per row could be batched but okay for typical bank CSV (100-1000 rows)
- **Security**: RLS, grants, SECURITY DEFINER pinned search_path, no trusted client company_id, file size 5MB client limit
- **Accessibility**: aria-labels, focus trap, 44px touch targets, safe-area, keyboard Esc
- **RTL**: dir="rtl", safe-area left/right, arrow rotate 180 in RTL
- **Dark mode**: semantic tokens, BottomSheet bg card, border

---

## Decisions Log

| Decision | Date | Owner | Status |
|---|---|---|---|
| Archive wording for soft-delete | 2026-08-05 | Stage 4 | Implemented |
| PageHeaderActions overflow BottomSheet | 2026-08-05 | Stage 4 | Implemented |
| Fail-closed CSV import | 2026-08-05 | Stage 4 | Implemented |
| Fingerprint all fields | 2026-08-05 | Stage 4 | Implemented |
| SHA-256 file fingerprint idempotency | 2026-08-05 | Stage 4 | Implemented |
| No accounting posting in import | 2026-08-05 | Stage 4 | Implemented (contract test) |
| Rollback keeps columns for safety | 2026-08-05 | Stage 4 | Implemented |
```

