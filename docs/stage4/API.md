# API Documentation — Bank CSV Import & Action System

## Authentication
- Supabase Auth JWT required
- `auth.uid()` must be non-null and `is_app_user()` true
- Role check: `is_admin_or_manager()` (ADMIN or MANAGER) for import, otherwise 42501
- Company isolation: `current_company_id()` from JWT app_metadata, not trusted from client

## RPC: import_bank_statement_batch_atomic

**Signature**
```sql
create or replace function public.import_bank_statement_batch_atomic(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp;
```

**Grants**
```sql
revoke all on function import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute to authenticated, service_role;
owner to postgres;
```

**Request (payload jsonb)**
```json
{
  "bank_account_id": "uuid (required, must belong to caller's company)",
  "file_name": "statement.csv (optional, source filename)",
  "file_fingerprint": "sha256 hex string (required, deterministic file hash)",
  "file_size": 12345,
  "rows": [
    {
      "transaction_date": "2026-01-15 (YYYY-MM-DD, required)",
      "amount": 250.5,
      "description": "تحصيل إيجار - شقة 101",
      "reference": "REC-1001 (optional)",
      "balance": 1500.75,
      "currency": "OMR (optional, 3-letter, defaults OMR)"
    }
  ]
}
```

**Validation (fail-closed)**
- bank_account_id required, exists, deleted_at null, company_id = current_company_id()
- file_fingerprint required
- rows array non-empty, each row:
  - transaction_date castable to date else 22023 "Invalid transaction_date at row N"
  - amount numeric non-zero else 22023 "Invalid amount at row N"
  - description trimmed, defaults to "حركة مستوردة"
  - reference lower trimmed, optional
  - currency upper trimmed, 3-letter or OMR default

**Idempotency**
- First check: `SELECT * FROM bank_statement_imports WHERE company_id = v_company AND file_fingerprint = p_fp AND deleted_at IS NULL`
- If found → return existing batch immediately (no new lines)
- Insert with unique index `ux_bank_imports_company_fingerprint (company_id, file_fingerprint) WHERE deleted_at IS NULL` + exception handler for race

**Duplicate Detection**
```sql
-- Exact duplicate fingerprint:
fingerprint = md5(company_id || '|' || bank_account_id || '|' || date || '|' || to_char(amount,'FM999...0.000') || '|' || currency || '|' || lower(ref) || '|' || lower(desc))

-- Existing fingerprints preloaded:
SELECT array_agg(fingerprint) FROM bank_statement_lines WHERE company_id=v AND bank_account_id=v AND deleted_at IS NULL

-- Possible duplicate (same date+amount different fingerprint):
EXISTS (SELECT 1 FROM bank_statement_lines WHERE company_id=v AND bank_account_id=v AND transaction_date=date AND amount=amount AND deleted_at IS NULL)
```

- Intra-file duplicates: `v_seen_fps` array, if already seen → duplicate_rows++
- DB exact duplicates: if fingerprint in `v_existing_fps` → duplicate_rows++
- Possible duplicates: if date+amount exists but fingerprint new → possible_duplicate_rows++ but still inserted (reviewable)

**Insert**
```sql
INSERT INTO bank_statement_imports (
  company_id, bank_account_id, statement_name, file_name, file_fingerprint,
  file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
  possible_duplicate_rows, status, error_summary, processed_at, created_by
) VALUES (...)

-- Lines:
INSERT INTO bank_statement_lines (
  company_id, import_id, bank_account_id, transaction_date, description,
  reference, amount, balance, currency, external_reference, fingerprint, status
) VALUES (...)
ON CONFLICT (company_id, fingerprint) WHERE fingerprint IS NOT NULL AND deleted_at IS NULL DO NOTHING
```

**Response (jsonb)**
```json
{
  "id": "uuid",
  "reference": "BNK-2026-000123 (server-generated via trigger)",
  "bank_account_id": "uuid",
  "file_name": "statement.csv",
  "file_fingerprint": "abc123...",
  "total_rows": 100,
  "accepted_rows": 95,
  "rejected_rows": 0,
  "duplicate_rows": 3,
  "possible_duplicate_rows": 2,
  "status": "completed | duplicate | failed",
  "is_duplicate_file": false
}
```

**Status meanings**
- `completed`: accepted >0
- `duplicate`: accepted=0 and duplicate>0 (file duplicate or all rows duplicates)
- `failed`: not used currently, would be for validation error (exception instead)
- `is_duplicate_file`: true if file_fingerprint already existed, returns existing batch

**Error Codes**
- `42501`: auth, company, permission, or bank account not in company
- `22023`: validation (missing bank_account_id, file_fingerprint, rows empty, invalid date/amount)

**No Accounting Side Effects**
- Does NOT insert into `journal_entries`, `journal_batches`, `journal_lines`
- Only `bank_statement_imports` and `bank_statement_lines` (status unmatched)
- Reconciliation language: imported → needs manual review, suggested matches via separate query, not auto-reconciled

---

## Client Service: bankCsvImportService.ts

```ts
import { previewBankCsvFile, importBankStatementBatch, toImportPayloadRows } from '@/features/financials/reconciliation/bankCsvImportService';

// Preview (client-only, no DB)
const preview = await previewBankCsvFile(file);
// preview: {fileName, fileSize, encoding (UTF-8/BOM), delimiter (,/;), detectedDelimiterConfidence, totalRows, headers, columnMapping, mappingAmbiguous, missingMandatory, validRows, rejectedRows, duplicateWithinFile, previewRows, fileFingerprint}

// Convert to RPC payload
const payloadRows = toImportPayloadRows(preview);
// [{transaction_date: '2026-01-01', amount: 100.5, description, reference, balance, currency}]

// Import (atomic)
const result = await importBankStatementBatch({
  bank_account_id: 'uuid',
  file_name: file.name,
  file_fingerprint: preview.fileFingerprint,
  file_size: file.size,
  rows: payloadRows
});
```

**File fingerprint** (client):
```ts
import { computeFileFingerprint } from '@/lib/bankCsvParser';
const fp = await computeFileFingerprint(text);
// Uses SubtleCrypto SHA-256 if available, fallback djb2 hash
```

---

## Action System Contracts

### ConfirmDialog
```tsx
<ConfirmDialog
  open={!!candidate}
  onOpenChange={(o) => { if (!o && !isPending) setCandidate(null) }}
  title={`أرشفة العقار "${title}"؟`}
  description={`المرجع: ${reference} — ... — يمكن استرجاعه`}
  confirmLabel="تأكيد الأرشفة"
  isLoading={isPending} // disables close on Esc/outside, disables buttons
  onConfirm={async () => {
    if (isPending) return; // guard double click
    try { await mutateAsync(id); setCandidate(null) }
    catch { /* keep open */ }
  }}
/>
```

**Guarantees**
- Button disabled while pending
- Dialog stays open on failure (catch preserves context)
- No raw UUID as main label
- Shows business reference + context

### PageHeaderActions
```tsx
<PageHeaderActions
  title="العقارات"
  primaryAction={<Button>إضافة عقار</Button>}
  secondaryActions={<><Button>تصدير CSV</Button></>}
/>
```
- Desktop: secondary flex inline
- Mobile (<640px): MoreVertical overflow → BottomSheet with safe-area, 44px targets, menu within viewport
- Primary always visible compact

### Permissions
```ts
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
const canManage = canAccess(authz, financialOperationPermissions.matchBankReconciliation);
// ADMIN, MANAGER can; USER cannot
```

---

## Rate Limits & Pagination
- Bank lines: `listBankStatementLines` uses `fetchAllRows` with deterministic order `transaction_date DESC, id DESC` to avoid skip/duplicate at page boundary
- Import: file size max 5MB client validation, rows typical <10k, RPC loop O(n) with existence checks; for >10k consider chunking (not implemented)
- No rate limit on RPC beyond Supabase default; idempotency prevents double-billing

## SDK Examples
See `rentrix-app/src/features/financials/reconciliation/bankCsvImportService.test.ts` and `bankCsvParser.test.ts` for usage.

## Error Handling
- Client parsing: `rejectedRows` array with `rowNumber`, `reason`, `raw`, `field`
- Server validation: exception with message "Invalid transaction_date at row N: ..."
- UI: toast.error(message), dialog stays open, context preserved
```

