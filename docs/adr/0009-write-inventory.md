# ADR-0009 — Frontend write inventory

**Status:** Accepted (2026-08-01)  
**Decision:** financial mutations must remain behind a server-side atomic RPC; direct writes are only permitted for non-financial aggregates after schema parsing and explicit field allowlisting.

## Financial — atomic RPC required

| Domain | Canonical RPC / status |
|---|---|
| Contracts | `create_contract_atomic`, `update_contract_atomic`, lifecycle RPCs |
| Invoices and payments | invoice/payment/void atomic RPCs |
| Deposits | `create_deposit_atomic`, `deduct_deposit_atomic`, `refund_deposit_atomic` |
| Expenses | `create_expense_with_journal_atomic`, `update_expense_with_journal_atomic` |
| Maintenance | maintenance atomic RPC |
| Owner settlements | preview/create settlement RPCs; server-derived amounts |

The contract test at `src/test/db-contract/financial-writes-bypass.test.ts` forbids frontend raw writes to core ledger tables (`journal_entries`, `invoices`, `invoice_items`, `payments`, `payment_allocations`, and `tenant_deposits`).

## Non-financial — schema/allowlist required

Current services write operational aggregates: people, owners/property owners, properties, units, lands, leads, utilities, communication records, automation rules/notifications, company settings, cost centres, payment-term templates, document metadata, and bank-import metadata. Each service must parse its service payload, use a field allowlist, and map database failures to a domain error.

## Raw / remediation queue

The following write surfaces need an explicit hardening audit before they can be considered schema-gated: `commissions` (financial impact), bank-reconciliation import/line writes, settings cost-centres/payment-term templates, automation rule/notification writes, governance role writes, document-vault metadata, and contract-document metadata. No raw frontend write is permitted for the core ledger tables above.

## Inventory method

Search all feature sources for `.insert(`, `.update(`, `.upsert(`, `.delete(` and `.rpc(` whenever adding a feature. Classify each newly introduced write in this ADR and add a contract test for a newly protected financial table.
