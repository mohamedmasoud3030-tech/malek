# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Ready now

_Both items previously listed here — applying the 2 committed-but-unapplied migrations, and dropping the 9 orphaned enum types — were completed on production (`nnggcnpcuomwfuupupwg`) on 2026-07-05. See `docs/CURRENT_STATE.md` for details._

## Needs investigation

- Commissions scope investigation is complete: `features/commissions/` is confirmed as an operational tracking view only, not a payout/accounting feature. See `docs/DOMAIN.md` for the documented assumptions and the inactive/placeholder `expense_id` note.
- Test-script glob/discovery review is complete: `rentrix-app/package.json` now lets Vitest discover colocated `*.test.ts(x)` / `*.spec.ts(x)` files automatically, so new tests no longer need manual registration in the main test script.

## Data correctness follow-ups

- Sessions RLS ownership is fixed for future applies by `20260705000004_fix_sessions_rls_user_id.sql`; apply and verify it on production to close the live `sessions.*_own` policy bug.
- Date-only input defaults have been hardened away from `toISOString().slice(0, 10)` UTC slicing, including the financial expense-date flow; a regression test now scans production source files so future date-only values use local calendar parts instead.

## Later

- Bank reconciliation follow-up: foundation schema/UI plus CSV paste import and basic date/amount suggestions exist; add bank-file upload/format mapping, duplicate detection, advanced reconciliation rules, and production apply/verification.
- Security deposit management — not found in migrations or `src/features`.
- Deferred revenue handling — not found in migrations or `src/features`.
- Multi-currency support — not found in migrations or `src/features`; current `Invoice`/`Expense`/`PaymentReceipt` types use a single unqualified `amount` number.
