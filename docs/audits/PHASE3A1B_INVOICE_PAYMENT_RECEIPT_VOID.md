# Phase 3A-1B — Canonical Account Resolution for Invoice, Payment, Receipt & VOID

Date: 2026-07-24
PR: #1281 (draft)  
Branch: `phase3a/invoice-payment-receipt-void-account-resolution`
Base: `39e70867cfb44c05f0c5298d278811e8da640d56` (origin/main, Phase 3A-1A #1280)

## Scope

This unit closes company-scoped account resolution only for the invoice → payment
→ receipt → VOID lifecycle. It does not remove the legacy global uniqueness of
`accounts.no` (Phase 3A-2), does not touch owner settlements (Phase 3A-1C), does
not alter revenue/commission rules, proration, invoice numbering, or the
payment/receipt shared identity (`payments.id = payments.receipt_id`), and does
not mutate Production.

## Active-definition inventory (§2)

Captured from the live replayed catalog (never hand-written):
`evidence/p3/phase3a1b/active-financial-function-inventory.json` — per overload:
full identity signature, last defining migration, SECURITY DEFINER, pinned
`search_path`, owner, ACL (`proacl` + effective EXECUTE per role), app call sites,
internal callers, and anti-pattern flags — in both the **pre-remediation** state
(chain replay without the 3A-1B migration) and the **post** state.

8 live overloads across 7 names:

| signature | last defining migration | classification pre-3A-1B | pre-state defects |
|---|---|---|---|
| `find_payment_account_id(text)` | `20250101000003` | active (internal, called by `record_invoice_payment_atomic`) | global `WHERE a.no = v_target_no LIMIT 1` — could return another company's account or `NULL` silently |
| `generate_invoices_from_active_contracts()` | `20260722000002` | active (app, POST `/rpc/generate_invoices_from_active_contracts`) | `WHERE no='1201'/'4000'/'2100' LIMIT 1`; global `company_settings LIMIT 1`; **contract loop iterated ALL companies' contracts** and stamped them with the caller's `company_id` |
| `record_invoice_payment_atomic(jsonb)` | `20260724120000` (P0) | active (app) | accounts via unscoped `find_payment_account_id`; idempotency operation name globally keyed |
| `post_receipt_atomic(jsonb)` | `20260724120000` (P0) | active (internal + `authenticated`-exposed) | replay lookup `WHERE request_id` unscoped; client-supplied `journal_entries[].account_id` inserted verbatim (no ownership validation) |
| `void_receipt_atomic(jsonb)` | `20260723000000` | active (app) | **zero company scoping** — payment/receipt resolution crossed tenants; idempotency operation name globally keyed |
| `void_receipt_atomic(uuid, timestamptz, jsonb, jsonb)` (legacy) | `20260723000000` | live, unexposed (`authenticated`/`service_role` denied) | none addressed — **preserved byte-identical** (no proof of non-usage ⇒ no drop, no rewrite; §6) |
| `require_company_account_id(uuid,text)` / `ensure_company_account(uuid,text,text)` | `20260727091000` (3A-1A) | helpers | untouched (byte-identical md5 across the chain) |

Historical dropped overloads of `void_receipt_atomic` (`(uuid,bigint,jsonb,jsonb)`,
`(text,bigint,jsonb,jsonb)`) are listed in the inventory with their dropping
migrations. No historical migration was modified.

## Implemented controls

### Canonical accounts (§3/§4/§5)

- `find_payment_account_id` keeps its signature and role→number mapping
  (`cash→1111`, `receivable→1201`) but resolves through
  `require_company_account_id(current_company_id(), no)` — loud `P0001` when
  unconfigured, `23505` on ambiguity, `42501` without a company claim.
- `generate_invoices_from_active_contracts()`:
  - explicit `42501` company-context guard after JWT derivation;
  - AR `1201` / Revenue `4000` via `require_company_account_id(company, no)`;
  - VAT settings read is `WHERE company_id = v_company_id` (was global `LIMIT 1`);
  - VAT payable `2100` is required **only when VAT is actually charged** — the legacy
    fallback silently skipped the VAT credit and produced an unbalanced journal;
  - the active-contracts loop is `AND c.company_id = v_company_id` — company A can
    never generate for company B's contract.
- `record_invoice_payment_atomic` resolves `1111`/`1201` through the
  company-canonical `find_payment_account_id` (chain preserved, return payloads
  unchanged).
- `post_receipt_atomic` validates every client-supplied
  `journal_entries[].account_id` against the caller's company (`42501`) before
  insert — account ownership can no longer be asserted from the client.

### Idempotency isolation (§7)

`financial_operation_idempotency` is deliberately **unchanged** (PK
`(operation_name, request_id)`, no `company_id`). Operation keys are namespaced
`<operation_name>:<company_uuid>`:

- `record_invoice_payment_atomic:<company>` (lookup, insert, advisory lock key);
- `post_receipt_atomic:<company>` (lookup, insert, advisory lock key);
- `void_receipt_atomic:<company>` (lookup, insert, advisory lock key).

Same `request_id` in two companies can therefore never replay across tenants —
proven with execution tests for record, post, and void
(`evidence/p3/phase3a1b/idempotency-isolation.json`).

Within a company, **`request_id` identifies one immutable logical financial
request**. Each of the three RPCs computes a canonical SHA-256 fingerprint from only the
financially effective client fields after removing `request_id`; receipt
allocations and journal lines are sorted before hashing, so JSON array order
does not create a different request. Generated UUIDs, `created_at`, `now()`, and
other server defaults are excluded. The idempotency row stores an internal
envelope:

```json
{
  "_request_fingerprint": "…",
  "_target_id": "…",
  "response": {}
}
```

The external RPC shape is unchanged because replay returns only `response`.
Reusing a key for a different invoice/receipt/contract, amount, allocation,
journal, or VOID reason fails before any write with SQLSTATE `22023` and
`IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST`. A legacy/unverified cached
payload without the envelope fails closed with
`IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED`; it is never replayed and the operation
is never executed a second time silently.

**`receipts.request_id` doctrine:** post_receipt stores the RAW request id
(gate contract: `supabase/tests/release_blockers.sql` counts raw rows). The
replay lookup is company-scoped; a cross-company `request_id` collision then
fails **loudly** on the global `UNIQUE(receipts.request_id)` (`23505`) instead of
silently returning another company's receipt — identical doctrine to
`accounts.no` until Phase 3A-2.

### VOID (§6)

- The caller's company is derived from the JWT **before** the idempotency replay
  (`42501` when absent).
- Payment/receipt resolution is company-scoped: a cross-company identifier
  behaves exactly like "not found" (`P0002`) — no existence leakage, before any
  invoice/journal/audit/idempotency write.
- The reversal clones the ORIGINAL journal rows (`account_id`, amounts, flipped
  side) — account IDs are never re-looked-up, near-zero-risk equal-reversal
  doctrine; reversal happens at most once (`receipt_void` / `void:<receipt_id>`
  markers), re-VOIDing is idempotent, nothing is ever deleted, and the invoice
  balance reversal is additionally company-filtered.
- The legacy overload `(uuid, timestamptz, jsonb, jsonb)` is **byte-identical** in
  forward, rollback, and the replayed catalog (md5-pinned by tests).

### Company isolation (§8)

Every read (invoice/contract/receipt/payment/allocation/account/journal) is
company-scoped inside the SECURITY DEFINER body — RLS is never relied upon.
Failures happen before any write and roll back atomically
(`evidence/p3/phase3a1b/two-company-isolation.json`).

## Runtime coverage (§9)

Execution suites over a full PGlite migration replay with the two-company
fixture (`company → admin → accounts → owner → property → agreement → unit →
tenant → contract → invoices`):

- **Invoice posting**: generation, VAT 5% math (1050 = 1000 + 50), company-owned
  AR/REV/VAT journal lines, balanced batch, dedup retry (no duplicate
  invoice/journal), cross-company loop isolation, loud `P0001` for the
  unprovisioned company. → `invoice-posting-lifecycle.json`
- **Payment/receipt**: partial → settlement, idempotent retry (same receipt,
  one row, RAW request_id), immutable request binding (different invoice/amount
  rejected), overpay guard, multi-invoice allocation receipt, order-independent
  allocation/journal fingerprinting, contract-balance trigger parity, shared identity (`payments.id =
  payments.receipt_id = receipts.id`). → `payment-receipt-lifecycle.json`,
  `payment-receipt-identity.json`
- **VOID**: void → same-request retry → new-request retry → void-by-payment
  identity; same key on another receipt or changed reason rejected; single
  mirrored reversal batch, statuses, invoice restoration, no deletion.
  → `void-reversal-lifecycle.json`
- **Invoice UPDATE scope**: allocation validation is repeated in the set-based
  UPDATE with `invoice_record.company_id = v_company_id` and
  `deleted_at IS NULL`; `GET DIAGNOSTICS ROW_COUNT` must equal the number of
  distinct allocation invoice IDs. A trigger-driven deletion between validation
  and UPDATE proves the mismatch aborts the whole receipt/payment/allocation
  transaction with no partial state. → `payment-receipt-lifecycle.json`
- **Idempotency isolation**: shared request ids across A/B for record (B fails
  loud on unprovisioned accounts), post (B hits loud 23505), void (B receives its
  OWN response). → `idempotency-isolation.json`
- **Forward/rollback chain (§11)**: baseline fingerprint (body md5 + definer +
  config + owner + ACL per overload) → forward → lifecycle smoke → rollback →
  fingerprint ≡ baseline AND financial snapshot unchanged (no rows deleted or
  rewritten) → reapply → fingerprint ≡ forward → lifecycle smoke.
  → `forward-rollback-fingerprint.json`

Tests:

- `rentrix-app/src/p3/phase3a1b-inventory-catalog.test.ts`
- `rentrix-app/src/p3/phase3a1b-execution.test.ts`
- `rentrix-app/src/p3/phase3a1b-forward-rollback.test.ts`
- `rentrix-app/src/p3/phase3a1b-fixture.ts` (shared fixture)

## Catalog contract after replay (§10)

`evidence/p3/phase3a1b/catalog-contract.json` + the catalog tests assert:
no covered active definition keeps `WHERE no='…' LIMIT 1`, hardcoded account
ids, or `ON CONFLICT (id) DO NOTHING` in an account context; `authenticated`
keeps only the public RPCs; internal helpers (`find_payment_account_id`, legacy
void overload, 3A-1A helpers) stay unexposed; `search_path` stays pinned;
grants were never re-issued (CREATE OR REPLACE preserves ACLs — rollback and
forward fingerprints match byte-for-byte).

Neighboring-suite maintenance (all before/after-verified):

- `supabase/tests/release_lifecycle_rehearsal.sql`: the void idempotency
  assertion now expects the company-namespaced operation key (pgTAP intent
  unchanged; 65/65 assertions still pass on the full-chain shim and in the
  Docker-free verifier).
- P0 replay harnesses (`src/p0/replay-bootstrap.ts`,
  `src/p0/p0-multi-tenant-isolation.test.ts`): the 3A-1B migration is excluded
  from the P0 checkpoint chains — the exact precedent used for
  `p1_owner_settlement` / `phase2_financial_integrity`, because this migration
  redefines functions that P0 fingerprints/probes pin to their P0-era semantics.
- `sonar-project.properties`: `src/p2`, `src/p3` added to the tooling exclusions.

## Migrations & rollbacks

- `supabase/migrations/20260728090000_phase3a1b_canonical_accounts_invoice_payment_receipt_void.sql`
  — redefines `find_payment_account_id`, `generate_invoices_from_active_contracts`,
  `record_invoice_payment_atomic(jsonb)`, `post_receipt_atomic(jsonb)`,
  `void_receipt_atomic(jsonb)`; adds immutable request binding and the
  company-scoped invoice row-count assertion; no grants re-issued; legacy
  overload untouched.
- `supabase/rollback/20260728_rollback_phase3a1b_invoice_payment_receipt_void.sql`
  — restores the five previous definitions (bodies captured from the origin/main
  replayed catalog via `pg_get_functiondef`); preserves boosts/overloads; never
  deletes invoices/payments/receipts/allocations/journals/idempotency/audit rows.

## Deferred by design

1. Owner-settlement account resolution → Phase 3A-1C.
2. Composite `UNIQUE(company_id, no)` on `accounts` (+ per-company chart
   provisioning; relaxes both the `ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED`
   failure and the global `receipts.request_id` unique collision) → Phase 3A-2.
3. Settlement period-overlap exclusion and source claims.
4. PDC (post-dated checks).
5. Financial Center UI.

## Production safety

No Production mutation was performed as part of this PR. All database changes
remain migrations pending normal release controls after review and merge.
