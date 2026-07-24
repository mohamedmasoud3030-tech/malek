# ADR 0003 — Company-scoped account resolution before composite COA uniqueness

Status: Accepted for Phase 3A-1A  
Date: 2026-07-24

## Context

`public.accounts.no` is globally unique even though accounts now carry `company_id`. Historical financial RPCs also used global account IDs and fallback inserts such as `ON CONFLICT (id) DO NOTHING`. Enabling `UNIQUE(company_id, no)` before replacing those active paths caused duplicate-account failures during full migration replay.

The system must preserve current account IDs and financial references while preparing for multiple companies to use the same account numbers.

## Decision

1. Introduce strict company-scoped resolvers:
   - `require_company_account_id(company_id, account_no)` for configured accounts that must already exist.
   - `ensure_company_account(company_id, account_no, account_name)` only for documented baseline accounts required by atomic financial operations.
2. Do not expose these helpers directly to `authenticated`; they are implementation details of approved `SECURITY DEFINER` RPCs.
3. Generate new account IDs as `coa:<company_uuid>:<account_no>`, never as the account number alone.
4. Serialize provisional account creation by company and account number.
5. Until Phase 3A-2 removes global number uniqueness, fail explicitly with `ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED` when another company already owns the number.
6. Namespace idempotency operations by company where the legacy table lacks `company_id`.
7. Convert active financial RPCs in bounded PRs:
   - 3A-1A: expenses and deposits;
   - 3A-1B: invoices, payments, receipts, and VOID;
   - 3A-1C: owner-settlement lifecycle;
   - 3A-2: composite uniqueness and final provisioning.

## Consequences

### Positive

- No financial IDs or journal references are rewritten.
- Cross-company account selection fails closed.
- Existing single-company production remains compatible.
- Each financial lifecycle can be tested and rolled back independently.
- The final composite uniqueness migration is no longer coupled to legacy fallback inserts.

### Temporary limitations

- A second company cannot yet provision the same account number; the failure is explicit and intentional.
- Full chart-of-accounts provisioning is deferred to Phase 3A-2.
- `financial_operation_idempotency` still has a legacy global key, so Phase 3A-1A uses company-namespaced operation names pending a schema-level key change.

## Rejected alternatives

- **Change `accounts.no` uniqueness immediately:** rejected because active fallback inserts failed full replay.
- **Rewrite existing account IDs:** rejected because it would risk all journal and financial references.
- **Keep `LIMIT 1` lookups:** rejected because they can select another company’s account and hide duplicate corruption.
- **Expose helpers to every authenticated user:** rejected because callers could supply arbitrary company IDs to `SECURITY DEFINER` functions.
