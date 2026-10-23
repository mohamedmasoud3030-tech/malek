---
name: financial-correctness
description: Protect payments, deposits, refunds, fees, sales, expenses, settlements, daily closing, balances, profitability and financial reports from semantic or arithmetic errors. Use whenever a task touches money movement, money meaning, or money reporting in any portfolio product (MALEK, LENA products, Terranex, Kayyal, hospitality).
---

# Financial Correctness

## Financial meanings — keep separate in data, calculations, labels, reports

- **cash movement:** money entering or leaving by payment method;
- **revenue:** earned consideration under the completed business event;
- **deposit liability:** customer money held until refund or justified retention;
- **fees / retained deposits:** recognized only by an explicit settlement decision;
- **expense:** business cost, separate from customer refunds;
- **profitability:** recognized revenue minus relevant expenses, never raw collections.

## Invariants

- Deposits are liabilities until refunded or retained — not revenue.
- Money and weight arithmetic is **decimal**; binary floats are forbidden
  (portfolio rule, enforced by guards where present; see Kayyal ADR-0004).
- Financial movements are append-only; corrections use linked refunds,
  reversals, or adjustments — history is never overwritten.
- A refund is an outbound cash movement linked to the original business record.
- Settlement/reporting-only entries must not distort cash totals.
- Daily close groups actual cash movement by payment method and close period.
- Reports must state whether totals are collected, outstanding, recognized,
  held, refunded, retained, or paid as expenses.
- Financial writes and their related operational/audit transitions commit as
  ONE atomic operation (server/RPC-governed where the repo says so).

## Change method

1. Write the accounting meaning of every amount before changing code.
2. Identify the event that recognizes revenue or a fee; do not infer it merely
   from the existence of an order/reservation.
3. Trace the same movement through balances, history, daily closing, reports,
   backup/restore, and audit.
4. Prefer one canonical command per financial action.
5. Preserve original records; add linked corrective movements.
6. Currency-safe arithmetic with explicit rounding at documented boundaries.
   Never stamp a mixed-currency total with one currency (see Terranex money
   contract `by-currency`).

## Mandatory test matrix (adapt per product)

full/partial payment · mixed payment methods · deposit collected/refunded/
retained (full & partial) · late/damage fees · refund after closed day · sale
and sale return · cancellation with/without prior movement · duplicate
command/replay (idempotency) · forced failure between financial and
operational writes · daily-close reconciliation · source-to-report
reconciliation.

## Completion rule

A financial change is complete only when source movements, liabilities,
balances, daily close, reports, audit, and rollback behavior reconcile exactly
with no double counting.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
