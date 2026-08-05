# MALIK Verified Audit Matrix — 2026-08-05

**Repository baseline:** `main@f8e5556315b2ad2e76cfdd2a84431438e0932543`  
**Rule:** A repository fact is authoritative only for repository state. Production facts require a fresh connected production read.

## Decision matrix

| Area | Verified state | Decision |
|---|---|---|
| Open PR #1342 | Documentation only; contains stale/unsupported claims | Correct before merge |
| Open PR #1343 | Documentation only; describes guarantees not provided by Stage 4 code | Keep Draft until code and docs agree |
| Search-path hardening | Repository fix already exists in `20260730091000_reconcile_audit_journal_trigger_security.sql` | Remove “pending repository fix” claims; separately verify production if needed |
| Supabase Advisor counts | No fresh live evidence in the PR | Treat old counts as historical only; no index deletion |
| Canonical contract ID | UUID in source schema | Describe text as environment-specific drift only |
| Maintenance split | Active RPC accepts request, cost, notes only | Backend split allocation is not implemented |
| Sonar coverage | Application TS/TSX excluded | Fix quality-gate visibility |
| Stage 4 bank import | Operational workflow exists, but integrity guarantees are overstated | Repair before downstream accounting/reconciliation relies on it |
| General ledger | Canonical Stage 3 engine exists | Preserve; business events must feed it through explicit trusted boundaries |
| Business model | `property_management` and `master_lease` exist, but contractual terms/schedules are incomplete | Add operating model, agreement terms, and schedules before later posting stages |

## Stage 4 bank-import blockers

The following are verified directly in current code:

1. `toImportPayloadRows()` sends `validRows` only. A file with rejected source rows can still be partially imported.
2. The RPC stores `rejected_rows = 0` and estimates `accepted_rows` before line insertion.
3. Line insertion catches every exception and continues, allowing a completed batch to overstate persisted rows.
4. Blank descriptions are normalized differently between count and insert passes, producing fingerprint inconsistency.
5. File fingerprint and file-size/row limits are trusted to client behavior; the server does not independently enforce the client’s 5 MB boundary.
6. `balance numeric(14,2)` conflicts with OMR 3-decimal precision.
7. Headerless positional inference, silent invalid-currency fallback, and netting a row containing both debit and credit are unsafe defaults for financial import.
8. The main review-step form submit does not invoke the import; a separate button does. The completed “go to matching” action only closes the overlay.
9. Migration verification is static string inspection; service tests mock Supabase. No behavioral RPC execution test was found.

### Idempotency nuance

`UNIQUE(company_id, file_fingerprint)` is not automatically incorrect. Company-wide deduplication may be intentionally stricter than account-scoped deduplication. The verified defect is that an existing fingerprint tied to another bank account is returned as a normal duplicate instead of raising an explicit account mismatch. Fix that behavior intentionally; do not change the key merely to satisfy a report.

## Correct execution sequence

1. Merge corrected audit documentation.
2. Add a forward-only bank-import integrity migration and matching client/parser changes.
3. Add behavioral database coverage and align Stage 4 documentation with actual guarantees.
4. Establish the verified property-management business model and contract schedules.
5. Continue accounting event posting only after the source business events are trustworthy.

## Evidence discipline

- Green CI proves the changed files passed configured gates; it does not prove prose is accurate.
- Historical status documents are snapshots, not current production evidence.
- Destructive performance actions require current Advisor output plus workload/query-plan evidence.
- Every financial count must reconcile to rows actually persisted, not rows predicted before insertion.
