# ADR 0005 — Account resolution and isolation policy for payment, receipt, and VOID

Status: Accepted for Phase 3A-1B
Date: 2026-07-24
Supersedes/extends: ADR 0003 (company-scoped account resolution), for the invoice/payment/receipt/VOID lifecycle

## Context

ADR 0003 introduced `require_company_account_id` / `ensure_company_account` and
converted expenses/deposits (3A-1A). The invoice → payment → receipt → VOID
lifecycle still contained these proven defects (see
`evidence/p3/phase3a1b/active-financial-function-inventory.json`):

1. `find_payment_account_id` resolved `1111`/`1201` via a global
   `WHERE a.no = ... LIMIT 1` — it could return another company's account or
   `NULL` silently; the caller raised a generic "not configured".
2. `generate_invoices_from_active_contracts()` looked up `1201/4000/2100` and
   `company_settings` globally, and its active-contracts loop iterated **every
   company's contracts**, stamping foreign invoices/journals with the caller's
   `company_id`.
3. `post_receipt_atomic` inserted client-supplied
   `journal_entries[].account_id` verbatim (only restamping `company_id`) — the
   client could nominate any account, including another company's.
4. `void_receipt_atomic(jsonb)` had zero company scoping: a cross-tenant
   receipt/payment identifier was voidable end-to-end.
5. `financial_operation_idempotency` is globally keyed
   (`PK(operation_name, request_id)`), so identical request ids shared across
   companies could leak cached financial responses.
6. Phase 3A-1A's role→number indirection (`find_payment_account_id`) is part of
   the active payment chain — deleting it would break the preserved payload
   contract.

Constraints: `accounts.no` stays globally unique until 3A-2 (ADR 0003);
`receipts.request_id` is globally unique and the release gate asserts RAW
request-id storage; the legacy overload
`void_receipt_atomic(uuid, timestamptz, jsonb, jsonb)` cannot be proven unused.

## Decision

1. **Canonical resolution inside the chain.** `find_payment_account_id` keeps its
   signature and role→number contract but delegates to
   `require_company_account_id(current_company_id(), no)`. `record_invoice_payment_atomic`
   keeps calling it — behavior at that site is unchanged while resolution becomes
   company-canonical.
2. **Fail loud, never fall back.** Unconfigured canonical accounts raise the
   helper's explicit errors (`P0001`/`23505`), including VAT `2100` — but `2100`
   is required only when VAT is actually charged, preserving VAT-disabled
   companies.
3. **Never trust client account ids.** `post_receipt_atomic` rejects any
   `journal_entries[].account_id` not owned by the caller's company (`42501`)
   before insert; the whole call rolls back atomically.
4. **VOID reuses original account ids.** Reversal journals clone the original
   entry's `account_id` (and amounts, flipped side) instead of re-resolving by
   number — reversal equality is structural, not lookup-dependent.
5. **Company-namespaced operation keys.** Idempotency keys and advisory-lock keys
   use `<operation_name>:<company_uuid>`; the table schema is unchanged (a
   schema change is possible later without a data migration since the format is
   additive).
6. **Loud global uniques until 3A-2.** The company-scoped receipts replay lookup
   never returns another company's receipt; a true cross-company `request_id`
   collision then fails on the global `UNIQUE(receipts.request_id)` with
   `23505` — documented doctrine, same as `accounts.no`.
7. **Preserve unproven overloads.** The legacy void overload stays byte-identical
   and unexposed; no overload is dropped without proof of non-usage.
8. **Company derivation is JWT-only** (`app_metadata.company_id` /
   `current_company_id()`); RLS is never relied upon inside `SECURITY DEFINER`.

## Consequences

### Positive

- Cross-company VOID, invoice generation, receipt posting, and account
  nomination are all closed with fail-before-write semantics (atomically rolled
  back, no audit/idempotency response).
- Idempotency replay is physically incapable of leaking across companies even
  though the base table gains no new column.
- Rollback restores the previous definitions byte-for-byte without touching any
  financial row (proven by fingerprint + financial snapshot equality).

### Temporary limitations

- Two companies cannot share one `request_id` for receipts (loud 23505) —
  relaxed with composite keys in 3A-2 alongside `accounts.no`.
- Receipts created before `company_id` existed (NULL) are not voidable via the
  payload RPC until backfilled — matching the strict write-path doctrine.

## Rejected alternatives

- **Add `company_id` to `financial_operation_idempotency` now:** rejected — the
  namespaced operation key achieves isolation without a schema/data migration;
  a later PR can normalize if desired.
- **Re-resolve VOID accounts by number at reversal time:** rejected — the global
  `no` lookup can return another company's account; cloning original ids is
  exact by construction.
- **Drop the legacy void overload:** rejected — no proof of non-usage; it is
  unexposed and harmless, and dropping becomes trivially safe to decide later.
- **Trust RLS inside SECURITY DEFINER:** rejected (standing policy) — definer
  contexts bypass row policies.
