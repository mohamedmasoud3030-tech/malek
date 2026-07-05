# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Ready now

- Confirm whether `dexie` (in `rentrix-app/package.json` dependencies) is still needed. No import usages were found under `rentrix-app/src`. Remove it if unused, or document what it's for if it's reserved for planned work.

## Needs investigation

- Verify `record_invoice_payment_atomic` / `find_payment_account_id` against the live Supabase project, not just the migration file and its contract test. The migration and test look correct on inspection, but live-database behavior should be confirmed directly.
- Confirm the actual scope of the Commissions module (`features/commissions/`) — the navigation copy describes it as an operational tracking view only. Document assumptions if it needs to become a full payout/accounting feature.
- Review whether the fixed test-file list in `rentrix-app/package.json`'s `test` script should be replaced with a glob, so new test files are picked up automatically instead of needing manual registration.

## Later

- Bank reconciliation (matching bank statement lines against recorded transactions) — not found in migrations or `src/features`.
- Security deposit management — not found in migrations or `src/features`.
- Deferred revenue handling — not found in migrations or `src/features`.
- Multi-currency support — not found in migrations or `src/features`; current `Invoice`/`Expense`/`PaymentReceipt` types use a single unqualified `amount` number.
