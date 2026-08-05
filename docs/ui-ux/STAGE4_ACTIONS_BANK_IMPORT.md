# Stage 4 — Action System, Archive/Delete Semantics, Mobile Actions, Bank CSV Import

This document is an entry point that links to the detailed Stage 4 documentation in `docs/stage4/`.

- **Overview & Quick Start**: `docs/stage4/README.md`
- **API Reference**: `docs/stage4/API.md`
- **Runbook**: `docs/stage4/RUNBOOK.md`
- **Architecture**: `docs/stage4/ARCHITECTURE.md`
- **Onboarding**: `docs/stage4/ONBOARDING.md`

## Summary of Changes (from PR #1341, merge f8e5556)

- **Action wording**: All soft-deletes now say **أرشفة** (or إلغاء/تجاهل), never misleading permanent delete. Business reference (CNT-/BNK-/...) shown, not UUID.
- **Double-submit guard**: Confirm button disabled while pending, guard `isPending`, dialog stays open on failure, preserves context, only closes on success.
- **Unified action system**: `PageHeaderActions` — primary compact always visible, secondary grouped, destructive separated, permission-hidden returns null, 44px touch targets, safe-area, BottomSheet overflow on mobile <640px.
- **Mobile**: Tested at 320/390/430, primary visible, secondary into ⋮ overflow, menu within viewport, dialogs fit screen.
- **Bank CSV import**: Staged workflow file→validate→parse/preview→mapping→review→confirm→batch→summary→reconciliation. Supports UTF-8/BOM, AR/EN headers, comma/semicolon auto-detect, quoted commas, OMR 3-dec, debit/credit, blank rows, invalid handling, duplicate header detection, no silent guess. Server RPC `import_bank_statement_batch_atomic` atomic, idempotent via file_fingerprint unique index, duplicate via fingerprint md5(company|account|date|amount 3dec|currency|ref|desc), company isolation, permission ADMIN/MANAGER, reference BNK- generated via trigger, no accounting postings, language "مستوردة" not auto-reconciled.

## Security

- RLS `p0_tenant_isolation`, grants revoked public/anon, SECURITY DEFINER pinned search_path, company_id from JWT, bank account belongs to company check, file size 5MB client limit.

## Tests

- 307 files / 1778 tests green, including `bankCsvParser.test.ts`, `bankCsvImportService.test.ts`, `action-system.test.tsx`, `page-header.test.tsx`, `bank-csv-import-migration-contract.test.ts`

## No Accounting Stage 4

Confirmed no OWNER_IS_CREDITOR, OFFICE_IS_CREDITOR, rent posting, settlement, VAT, periods, reversals, etc. Only operational import and reconciliation records.

---

See `docs/stage4/README.md` for quick start.
