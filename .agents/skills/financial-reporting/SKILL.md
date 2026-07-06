---
name: financial-reporting
description: Use for Rentrix reports and financial workflows involving collections, payments, receipts, settlements, bank reconciliation, owner/tenant statements, or accounting totals. Do not use for unrelated UI, auth, maintenance, or property-management changes with no financial calculation or reporting effect.
---

# Financial Reporting

Apply this skill whenever Rentrix work affects financial reports, financial totals, receipts, payments, settlements, or reconciliation.

## Required workflow

1. State the accounting basis explicitly before implementation or review: collected, invoiced, paid, accrued, or another named basis.
2. Identify every table/RPC/service that contributes to the total, including whether data comes from payments, receipts, invoices, contracts, expenses, settlements, or bank statement lines.
3. Define how VOID, reversals, soft-deleted rows, and deleted rows are included or excluded.
4. Reconcile daily reports, detail rows, summary totals, and any dashboard values that should agree.
5. For bank reconciliation, verify matching rules, unmatched items, duplicate handling, and amount/date tolerances that are in scope.
6. Do not claim a report is accurate without tests that cover critical financial cases and edge cases relevant to the calculation.

## Completion standard

A financial report is not ready until its basis is documented, VOID/reversal/delete handling is explicit, detail and summary totals reconcile, and tests cover the critical financial scenarios.
