# Product and Accounting Decision Gates

This document tracks Phase 5 of the 99.9% readiness roadmap. The product/accounting policy blockers have now been resolved by signed decision records, but each gate still requires implementation proof before Rentrix can claim production accounting readiness.

## Source-of-truth decisions

- `docs/decisions/0001-product-accounting-policies.md` is the current source of truth for office fees, master lease accounting, daily/open-ended contracts, utility billing, maintenance allocation, tenant deposits, and deferred revenue/accounting basis.
- `docs/decisions/0002-staging-live-verification-and-release-evidence.md` is the current source of truth for staging/live verification and release evidence governance.
- `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md` is the current source of truth for the financial golden path, authorization scope, UX/mobile/RTL acceptance, required reports/statements, and bank reconciliation launch scope.

## Gate status

| Gate | Current status | Blocks | Decision artifact | Implementation proof still required |
| --- | --- | --- | --- | --- |
| Office fee rules | Product decided; implementation required | FGR-005, owner statements, income reporting | `docs/decisions/0001-product-accounting-policies.md` | Migration/RPC/service/UI/report/export tests proving collected-basis default, contract overrides, percentage/fixed fees, VAT configurability, void/refund/reversal treatment, and owner settlement/report totals |
| Master lease accounting | Product decided; implementation required | FGR-011, owner obligations, office profit reporting | `docs/decisions/0001-product-accounting-policies.md` | Ledger/RPC/service/UI/report tests for fixed owner obligation schedules, monthly default cadence, vacancy behavior, approval/payment lifecycle, liabilities, and profit reporting |
| Daily/open-ended contract behavior | Product decided; implementation required | FGR-008, contract lifecycle, invoice generation | `docs/decisions/0001-product-accounting-policies.md` | Contract schema/RPC/UI tests covering daily checkout invoices, configurable daily/weekly billing, proration by counted days/nights, open-ended renewal, termination, overdue behavior, and report segmentation |
| Utility bill posting | Product decided; implementation required | FGR-009, invoices, expenses, tenant/owner statements | `docs/decisions/0001-product-accounting-policies.md` | Tests proving tenant/owner/office/suspense targets, meter entry, split bills, threshold approval, due dates, reversal/correction, statements, and report totals |
| Maintenance charge allocation | Product decided; implementation required | FGR-010, maintenance resolution, invoices, owner/office expenses | `docs/decisions/0001-product-accounting-policies.md` | UI/RPC/service tests proving final responsibility at resolution, tenant invoice posting, owner/office expense posting, split allocations, approval thresholds, reversals, and audit logs |
| Tenant deposits | Product decided; implementation required | FGR-012, tenant balances, statements, refunds/forfeits | `docs/decisions/0001-product-accounting-policies.md` | Migration/service/report tests proving contract deposit ledger, tenant aggregate balance, approved offsets/refunds/forfeits, installments, liability presentation, and statement treatment |
| Deferred revenue / accounting basis | Product decided; implementation required | FGR-013, annual/prepaid rent reporting, period reports | `docs/decisions/0001-product-accounting-policies.md` | Report parity tests proving collection reports on cash basis, accounting reports on accrual/deferred basis, prepaid credit consumption, void/refund reversal, balance sheet liability, and deferred revenue schedule |

## Definition of done for a decided gate

A gate is not closed by a decision record alone. To close a gate:

1. Identify every affected table, RPC, service, report, UI flow, export, and audit log.
2. Document VOID, reversal, soft-delete, cancellation, backdated adjustment, rounding, and permission behavior for the implemented flow.
3. Add or update migrations/RPCs only after live schema verification and approved change control.
4. Add tests proving detail rows, summaries, statements, exports, reports, and audit evidence reconcile.
5. Run the relevant browser and Supabase readiness gates and archive the evidence for the exact release commit.

## Current branch outcome

This branch now converts the former Phase 5 product blockers into explicit source-of-truth decisions. The decisions unblock implementation planning, but the actual database, service, UI, report, export, backend authorization, staging golden-path, and production read-only evidence remain required before any 99.9% readiness claim.
