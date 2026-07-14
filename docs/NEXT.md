# Next

Short list of follow-up work, derived from gaps found while reviewing migrations, `src/features`, and test coverage. No TODO/FIXME/HACK markers or skipped tests were found in `rentrix-app/src` at the time of this check — the items below come from feature-area comparisons instead.

## Architecture refactor status

Architecture Phases A through E are complete and merged through PR #1145. [`ARCHITECTURE_EXECUTION_PLAN.md`](ARCHITECTURE_EXECUTION_PLAN.md) is now the execution ledger and verification contract, not an automatically recurring refactor queue. Do not start another broad tree/UI refactor from historical reports. New architecture work must begin from current code evidence and a bounded plan; product, accounting, data-correctness, and release work continues from this backlog.

## Critical — production staging QA findings (2026-07-11)

First-ever end-to-end financial cycle test (contract → invoice → payment → receipt) run against live production data (isolated `TEST-QA` / `00000000-0000-4000-900X`-prefixed rows) surfaced 4 previously-unknown production bugs, all fixed live via `apply_migration` on `nnggcnpcuomwfuupupwg` and now also committed as migration files:

1. `is_admin_or_manager()` / `is_app_user()` wrapper functions were missing `GRANT EXECUTE TO authenticated`, silently blocking all RLS-gated access to 8 tables (commissions, communication_records, contract_documents, cost_centers, lands, leads, owner_agreements, payment_terms_templates).
2. `create_contract_atomic` compared `text` columns to `date` parameters without a cast — **no contract had ever been successfully created via this RPC in production** before this fix.
3. `update_owner_balance_on_expense()` trigger unconditionally referenced `NEW.property_id`, which doesn't exist on `receipts` — **no receipt had ever been successfully posted in production**.
4. `update_tenant_balance()` trigger unconditionally referenced `NEW.contract_id`, which doesn't exist on `receipt_allocations` — broke `post_receipt_atomic` end-to-end.

**Unresolved architectural issue found during the same test:** `tenant_balances.tenant_id` has an FK to the legacy `tenants` table (40 rows), while `contracts.tenant_id` actually points to `people.id` (the documented source of truth per `DOMAIN.md`). Every existing `tenants` row happens to share an id with a `people` row, but any *new* tenant created only in `people` (the current official flow) will fail its first invoice/receipt against this FK. Needs a decision: drop the FK and standardize on `people`, or add sync. See `docs/CURRENT_STATE.md`.

QA cycle is still in progress — permission-boundary testing (non-admin role rejection), `void_receipt_atomic`, and report reconciliation checks remain, followed by full `TEST-QA` data cleanup.

## Recently completed

- Architecture execution Phases A–E are complete through PR #1145: app/feature boundaries, large operational-page decomposition, financial-report service boundaries, shared form/UI convergence, and documentation consolidation.
- Production migration cleanup from the earlier readiness pass is complete: the 2 committed-but-unapplied migrations were applied and the 9 orphaned enum types were dropped on `nnggcnpcuomwfuupupwg` on 2026-07-05. See `docs/CURRENT_STATE.md` for details.
- Phase -1 shared-components implementation is complete: the custom contract/property/unit/receipt cards were replaced by shared `EntityCard` patterns, `EntityForm` now unifies form structure, `formatPropertyUnitSummary` moved into the properties feature, and receipt mobile/table status rendering no longer hard-codes posted status.
- Phase 0 Settings + Auth verification is complete: production policy/function checks found no drift for F0-2/F0-3/F0-4, and F0-6 was fixed by moving the custom access-token hook role source to `public.users.role`. Keep `public.profiles.role` out of authorization logic unless a future schema change deliberately redefines it.

## Documentation and UX tracking

- `docs/README.md` is the maintained documentation index; historical reports belong under `docs/archive/`, not the repository root.
- `docs/agent-context/CONTEXT_MAP.md` is the canonical task-routing map for agents; keep it in sync when adding new high-risk task categories.
- `docs/ui/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` remains the active UI/navigation audit for sidebar, mobile drawer, viewport/safe-area, responsive, and RTL work. Use it for related UI branches instead of creating another one-off audit.
- Commissions scope investigation is complete: `features/commissions/` is confirmed as an operational tracking view only, not a payout/accounting feature. See `docs/DOMAIN.md` for the documented assumptions and the inactive/placeholder `expense_id` note.
- Test-script glob/discovery review is complete: `rentrix-app/package.json` now lets Vitest discover colocated `*.test.ts(x)` / `*.spec.ts(x)` files automatically, so new tests no longer need manual registration in the main test script.

## Data correctness follow-ups

- Sessions RLS ownership is fixed and applied to production: `sessions_select_own`, `sessions_insert_own`, `sessions_delete_own` now compare `auth.uid()` to `sessions.user_id` instead of `sessions.id`. Live `pg_policies` verified post-apply. Closed.
- Date-only input defaults have been hardened away from `toISOString().slice(0, 10)` UTC slicing, including the financial expense-date flow; a regression test now scans production source files so future date-only values use local calendar parts instead.

## Product/accounting implementation required before full property-management readiness

The former product/accounting decision blockers are now documented in `docs/decisions/0001-product-accounting-policies.md`, `docs/decisions/0002-staging-live-verification-and-release-evidence.md`, and `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md`. Treat those decision records as source of truth, but do not claim 100% operational or financial accuracy until the implementation and evidence below are complete.

1. Implement office-fee rules for `property_management`: collected-basis default, contract overrides, percentage/fixed fees, exclusions for deposits/refunds/pass-through utilities unless enabled, VAT configurability, reversals, approvals, and owner payout lifecycle.
2. Implement `master_lease` fixed owner obligation schedules independent of tenant collections, including monthly default cadence, vacancy behavior, liability tracking, approval/payment lifecycle, and office profit/loss reporting.
3. Add daily and open-ended tenant contract support using the decided checkout invoicing, configurable daily/weekly billing, proration, renewal/termination, overdue, deposit, and report-segmentation rules.
4. Implement utility-bill posting for water/electricity/internet/sewage with explicit tenant/owner/office/suspense targets, meter entry, split allocation, approval thresholds, due dates, reversals, statements, and reports.
5. Extend maintenance resolution so costs can be assigned to owner, tenant, office, or split responsibility at resolution and then posted to the correct invoice/expense/statement path with approval and audit evidence.
6. Implement tenant deposit ledgers and dual cash/accrual-deferred reporting before completing tenant balances and annual/prepaid rent reporting.
7. Harden operation-level financial permissions for payment creation, receipt voiding, settlement approval/payment, report export, bank reconciliation, backend RLS/RPC/grants, and denied-action UX.

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
