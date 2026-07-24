# Phase 3A-1A — Canonical Account Resolution for Expenses and Deposits

Date: 2026-07-24  
PR: #1280  
Branch: `phase3a/canonical-company-account-resolution`

## Scope

This unit closes company-scoped account resolution only for expense and tenant-deposit write paths. It does not remove the legacy global uniqueness of `accounts.no`, and it does not change invoice/payment/receipt/VOID or owner-settlement accounting.

## Implemented controls

- `require_company_account_id(company_id, account_no)` resolves exactly one account inside the supplied company and fails closed on zero or multiple matches.
- `ensure_company_account(company_id, account_no, account_name)` serializes provisioning with a transaction advisory lock and creates non-global IDs in the form `coa:<company_uuid>:<account_no>`.
- Both helpers are implementation details: `PUBLIC`, `anon`, and `authenticated` cannot execute them directly; only `service_role` can execute them directly.
- While `accounts.no` remains globally unique, attempting to provision the same number for another company fails with `ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED` instead of returning another company’s account or surfacing an opaque unique-key error.
- Expense create/update paths resolve `1111` and `6100` inside the active company and validate property, contract, cost center, expense, journal, and idempotency boundaries.
- Deposit receive/deduct/refund paths resolve `1111`, `2200`, and `6100` inside the active company.
- Deposit creation derives tenant/property/unit from the canonical contract under lock and rejects payload mismatches.
- Deposit deduction uses the deposit’s canonical property and rejects cross-property payloads.
- Idempotency operation names are namespaced by company for all five Phase 3A-1A operations.
- Cost centers now carry an additive `company_id`, backfilled from their property and enforced by a trigger.
- Expense update uses text-safe identifier comparison and canonical typed values, supporting both UUID and text historical baselines.

## Runtime coverage

The PGlite execution suite performs a full migration replay and executes:

- expense create, retry, amount/date update, balanced reversal, and company ownership checks;
- deposit receive, retry, partial deduction, partial refund, over-refund rejection, canonical contract/property checks, and balanced journals;
- helper ACL checks;
- company-namespaced idempotency checks;
- catalog security checks;
- forward → rollback (reverse order) → reapply (forward order), while proving no accounts, journal entries, expenses, or deposits are deleted.

Primary tests:

- `rentrix-app/src/p3/phase3a1a-execution.test.ts`
- `rentrix-app/src/p3/phase3a1a-rollback-chain.test.ts`
- `rentrix-app/src/p3-phase3a1a-account-resolution.test.ts`

## Migrations

- `20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql`
- `20260727092000_phase3a1a_execution_hardening.sql`
- `20260727093000_phase3a1a_cost_center_and_reason_hardening.sql`
- `20260727094000_phase3a1a_update_expense_type_safety.sql`

Each migration has a matching rollback file. Rollbacks are non-destructive to financial rows.

## Deferred by design

The following remain outside this PR:

1. Replace global `UNIQUE(accounts.no)` with `UNIQUE(company_id, no)`.
2. Provision a complete chart of accounts for every company.
3. Canonicalize invoice/payment/receipt/VOID account resolution.
4. Canonicalize owner-settlement account resolution.
5. Add settlement-period overlap exclusion and source claims.
6. PDC, Financial Center UI, and bank-reconciliation expansion.

These are the inputs to Phase 3A-1B, 3A-1C, and 3A-2 respectively.

## Production safety

No Production mutation was performed as part of this PR. All database changes remain migrations pending normal release controls after review and merge.
