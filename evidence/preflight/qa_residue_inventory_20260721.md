# Production QA Residue Inventory

Date: 2026-07-21 UTC  
Project: `nnggcnpcuomwfuupupwg`

## Safety boundary

This is a read-only inventory. No record was updated, soft-deleted, hard-deleted, voided, reversed, or recreated.

## Confirmed QA entity graph

A bounded case-insensitive search for explicit QA markers (`TEST-QA`, `QA-`, `QA_`, `E2E`, or `SMOKE`) was expanded through actual operational and financial relationships.

| Relation | Rows in the QA dependency graph |
|---|---:|
| Owners explicitly named as QA | 2 |
| People/tenants | 3 |
| Properties | 2 |
| Units | 2 |
| Contracts | 3 |
| Owner agreements | 2 |
| Invoices | 4 |
| Receipts | 4 |
| Payments | 2 |
| Receipt allocations | 4 |
| Tenant deposits | 0 |
| Deposit transactions | 0 |
| Expenses | 0 |
| Maintenance records | 0 |
| Owner settlements | 0 |
| Journal entries related by source/entity/test marker | 15 |
| Audit-log rows related by entity/user/test marker | 5 |

## Why direct deletion is unsafe

The graph includes active operational and accounting records:

- active contracts;
- posted and voided receipts;
- payments linked to invoices and receipts;
- receipt allocations;
- owner/property agreements;
- posted journal entries, including reversal evidence;
- audit history documenting prior QA cleanup and VOID operations.

Deleting only visibly named people, properties, or contracts would leave financial/audit inconsistencies or destroy accounting history. Direct deletion of posted journal and audit evidence would violate Rentrix's append-only and reversal model.

## Required cleanup design

Any future cleanup must be a reviewed forward-only migration or controlled administrative procedure that:

1. identifies exact QA root IDs through immutable allowlists, not a broad text match;
2. captures pre-cleanup counts, monetary sums, and journal-balance evidence;
3. preserves or explicitly classifies audit history;
4. uses reversals for posted financial effects rather than deleting posted journals;
5. handles allocations, payments, receipts, invoices, contracts, units, properties, agreements, owners, and people in dependency-safe order;
6. proves net accounting impact before and after cleanup;
7. executes transactionally where possible and aborts on unexpected row counts;
8. is rehearsed on an isolated restored copy or against a verified logical backup;
9. requires explicit product-owner approval immediately before execution.

## Current decision

QA cleanup is **BLOCKED** because no verified restorable Production backup or restore rehearsal is available on the current Free-plan project.

Do not execute ad-hoc deletes, ledger repair, migration application, or cleanup SQL until the backup and approval gates are satisfied.
