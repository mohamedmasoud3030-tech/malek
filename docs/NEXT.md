# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Ready now

- **Apply the 2 committed-but-unapplied migrations to production** (deliberate operator action, not a code change): `20260616090000_complete_planned_product_modules.sql` (creates `communication_records`) and `20260703010000_contract_documents.sql` (creates `contract_documents`). Confirmed missing from `nnggcnpcuomwfuupupwg` as of 2026-07-05. The PR #1036 contract-document-upload feature will fail live until `contract_documents` is applied. Run via `apply_migration` against the live project — see `supabase/migrations/README.md`.
- **Audit the 9 orphaned live enum types** (`contract_status`, `invoice_status`, `invoice_type`, `journal_entry_type`, `maintenance_status`, `payment_method`, `property_status`, `transaction_status`, `unit_status`) for usage outside table columns — function signatures, view definitions, RLS policy expressions cast to the type — before deciding whether to capture them in a migration or drop them from `nnggcnpcuomwfuupupwg`. A column-only check (already done) would miss these. See `docs/CURRENT_STATE.md`, "Baseline capture strategy and ordering."

## Needs investigation

- Verify `record_invoice_payment_atomic` / `find_payment_account_id` against the live Supabase project, not just the migration file and its contract test. The migration and test look correct on inspection, but live-database behavior should be confirmed directly.
- Confirm the actual scope of the Commissions module (`features/commissions/`) — the navigation copy describes it as an operational tracking view only. Document assumptions if it needs to become a full payout/accounting feature.
- Review whether the fixed test-file list in `rentrix-app/package.json`'s `test` script should be replaced with a glob, so new test files are picked up automatically instead of needing manual registration.

## Later

- Bank reconciliation (matching bank statement lines against recorded transactions) — not found in migrations or `src/features`.
- Security deposit management — not found in migrations or `src/features`.
- Deferred revenue handling — not found in migrations or `src/features`.
- Multi-currency support — not found in migrations or `src/features`; current `Invoice`/`Expense`/`PaymentReceipt` types use a single unqualified `amount` number.
