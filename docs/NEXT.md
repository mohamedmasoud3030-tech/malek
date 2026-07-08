# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Recently completed

- Production migration cleanup from the earlier readiness pass is complete: the 2 committed-but-unapplied migrations were applied and the 9 orphaned enum types were dropped on `nnggcnpcuomwfuupupwg` on 2026-07-05. See `docs/CURRENT_STATE.md` for details.
- Phase -1 shared-components implementation is complete: the custom contract/property/unit/receipt cards were replaced by shared `EntityCard` patterns, `EntityForm` now unifies form structure, `formatPropertyUnitSummary` moved into the properties feature, and receipt mobile/table status rendering no longer hard-codes posted status.
- Phase 0 Settings + Auth verification is complete: production policy/function checks found no drift for F0-2/F0-3/F0-4, and F0-6 was fixed by moving the custom access-token hook role source to `public.users.role`. Keep `public.profiles.role` out of authorization logic unless a future schema change deliberately redefines it.

## Documentation and UX tracking

- `docs/agent-context/CONTEXT_MAP.md` is the canonical task-routing map for agents; keep it in sync when adding new high-risk task categories.
- `docs/ui/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` remains the active UI/navigation audit for sidebar, mobile drawer, viewport/safe-area, responsive, and RTL work. Use it for related UI branches instead of creating another one-off audit.
- Commissions scope investigation is complete: `features/commissions/` is confirmed as an operational tracking view only, not a payout/accounting feature. See `docs/DOMAIN.md` for the documented assumptions and the inactive/placeholder `expense_id` note.
- Test-script glob/discovery review is complete: `rentrix-app/package.json` now lets Vitest discover colocated `*.test.ts(x)` / `*.spec.ts(x)` files automatically, so new tests no longer need manual registration in the main test script.

## Data correctness follow-ups

- Sessions RLS ownership is fixed and applied to production: `sessions_select_own`, `sessions_insert_own`, `sessions_delete_own` now compare `auth.uid()` to `sessions.user_id` instead of `sessions.id`. Live `pg_policies` verified post-apply. Closed.
- Date-only input defaults have been hardened away from `toISOString().slice(0, 10)` UTC slicing, including the financial expense-date flow; a regression test now scans production source files so future date-only values use local calendar parts instead.

## Product/accounting decisions required before full property-management readiness

These are the highest-impact gaps from the Arabic workflow audit and the feature gap register. Treat them as design blockers before claiming 100% operational or financial accuracy.

1. Decide how office fees are calculated for `property_management`: collected-vs-invoiced basis, percentage vs fixed fee, expense deductions, reversals, approvals, and owner payout lifecycle.
2. Define `master_lease` as a fixed owner obligation schedule that is independent of tenant collections, including monthly/quarterly cadence and how office profit/loss is reported.
3. Add daily and open-ended tenant contract rules only after the billing cadence, end conditions, invoicing behavior, and reporting treatment are explicit.
4. Design utility-bill posting rules for water/electricity/internet/sewage: tenant invoice, owner/office expense, or utility subledger with generated financial records.
5. Extend maintenance resolution so costs can be assigned to owner, tenant, office, or shared responsibility and then posted to the correct invoice/expense/statement path.
6. Decide deposit ledger and cash-vs-accrual/deferred-revenue policies before completing tenant balances and annual/prepaid rent reporting.
7. Harden operation-level financial permissions for payment creation, receipt voiding, settlement approval/payment, and report export.

## Later

- Bank reconciliation follow-up: foundation schema/UI plus CSV paste import and basic date/amount suggestions exist; add bank-file upload/format mapping, duplicate detection, advanced reconciliation rules, and production apply/verification.
- Security deposit management — not found in migrations or `src/features`.
- Deferred revenue handling — not found in migrations or `src/features`.
- Multi-currency support — not found in migrations or `src/features`; current `Invoice`/`Expense`/`PaymentReceipt` types use a single unqualified `amount` number.

## Ready now — financial data consistency follow-ups

1. Apply `20260706101000_align_payment_receipt_reporting_source.sql` in staging, then production only after approval.
2. Browser-verify invoice → payment → receipt → void → report totals.
3. Wire validated report RPCs one screen at a time; do not swap financial calculations without parity tests.
4. Continue contract lifecycle audit for sensitive direct updates/deletes.
