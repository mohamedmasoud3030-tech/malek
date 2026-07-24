# Phase 3A-1C — Owner-Settlement Account Resolution

Date: 2026-07-25
Branch: `phase3a/owner-settlement-account-resolution`
Base: `946a7b37065d7ae38d6432c7283e29db764fd391` (merged Phase 3A-1B, PR #1281)
PR: Draft PR to be opened from this branch

## Scope

This unit closes canonical account resolution, tenant isolation, immutable
request binding, and atomic update assertions for the owner-settlement
`create → approve → pay` and `create/approve → cancel` lifecycles. It preserves
the P1 server-derived amount tuple and every existing lifecycle state.

It does not change settlement calculations, period-overlap policy, account
schema, global `accounts.no` uniqueness, chart provisioning, Production data, or
any Phase 3A-2 concern.

## Active-definition inventory

The live read-only inventory and full replay identified four public app RPCs:

- `create_owner_settlement_draft_atomic(jsonb)` — latest P1 definition;
- `approve_owner_settlement_atomic(jsonb)`;
- `pay_owner_settlement_atomic(jsonb)`;
- `cancel_owner_settlement_atomic(jsonb)`.

`calculate_owner_net_payout(...)`, `require_company_account_id(...)`, the
amount-immutability trigger, and all tables/policies remain untouched.

Before this patch, payout account lookup selected `accounts.no = '2000'` and
`'1111'` directly with `LIMIT 1`; approve/pay/cancel resolved the settlement
before applying company scope; and all four functions cached raw responses
under unnamespaced operation names without proving that a replay represented
the same logical request.

Evidence: `evidence/p3/phase3a1c/active-function-inventory.json`.

## Implemented contract

### Canonical payout accounts

`pay_owner_settlement_atomic` resolves:

- owner payable `2000`; and
- cash `1111`

through `require_company_account_id(v_company_id, account_no)`. Missing accounts
fail loudly and ambiguity remains fail-closed. There is no global account
fallback and no `LIMIT 1`.

The payout creates exactly two journal rows, asserts `ROW_COUNT = 2`, and then
updates exactly one company-owned settlement with a second row-count assertion.
Any failed assertion rolls back journal, status, audit, and idempotency writes
as one transaction.

### Immutable request binding

The rule is explicit:

> `request_id` identifies one immutable logical financial request inside one
> company.

Each RPC uses `<operation_name>:<company_uuid>`, validates its target before
cache replay, and stores:

```json
{
  "_request_fingerprint": "sha256(canonical financial payload)",
  "_target_id": "the immutable logical target",
  "response": {}
}
```

Only `response` is returned externally. Generated UUIDs and timestamps are
excluded. Reuse for a different target or payload fails before any write with
SQLSTATE `22023` and
`IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST`. A namespaced historical payload
without a verifiable envelope fails closed with
`IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED`.

Canonical fields:

- create: owner, optional property, period bounds, normalized notes;
- approve: settlement;
- pay: settlement, normalized method and payment reference;
- cancel: settlement and normalized reason.

### Tenant and update scope

Settlement, owner, and property targets are resolved within
`v_company_id`. Cross-company identifiers are indistinguishable from missing
records. Approve, pay, and cancel repeat the company predicate in their UPDATE
and assert exactly one affected row via `GET DIAGNOSTICS ... ROW_COUNT`.

## Execution evidence

The Phase 3A-1C PGlite suites exercise a full migration replay and record:

- same-request replay with no duplicate settlement, audit, journal, or cache row;
- different-target and changed-payload rejection for all four operations;
- legacy/unverified cache fail-closed behavior;
- cross-company not-found behavior before writes;
- a shared raw create request ID across companies never replays another
  company's cache; the legacy global `owner_settlements.request_id` unique
  index rejects the second insert loudly until its schema becomes
  company-relative;
- missing company accounts with the settlement left `APPROVED`;
- duplicate account numbers in two companies in a harness that models the
  future Phase 3A-2 schema, proving each payout selects only its company rows;
- balanced two-line payout with one batch;
- trigger-induced zero-row UPDATE after journal insertion, proving complete
  transactional rollback;
- forward → lifecycle → rollback → exact catalog fingerprint and unchanged
  financial snapshot → reapply → lifecycle.

Artifacts:

- `idempotency-isolation.json`
- `owner-settlement-lifecycle.json`
- `two-company-isolation.json`
- `canonical-account-resolution.json`
- `atomic-row-count.json`
- `catalog-contract.json`
- `active-function-inventory.json`
- `forward-rollback-fingerprint.json`

## Local release gates

Final pre-PR run on 2026-07-25:

- Phase 3A-1C execution/catalog/rollback: 7/7;
- full Vitest: 1075/1075 across 219 files;
- financial tests: 271/271 across 59 files;
- pgTAP release lifecycle rehearsal: 65/65, zero top-level errors;
- P0 forward/rollback and release-gate regression: green;
- P1 integrity and forward/rollback regression: green;
- Phase 3A-1A and 3A-1B regressions: green within full Vitest;
- typecheck, typecheck:test, lint, architecture, docs, and build: green.

The local build used the repository's permitted CI/development placeholder
Supabase environment; no deployment or Production mutation occurred. GitHub CI
status belongs in the Draft PR after its head SHA exists.

## Migration and rollback

- `supabase/migrations/20260729090000_phase3a1c_owner_settlement_account_resolution.sql`
- `supabase/rollback/20260729_rollback_phase3a1c_owner_settlement_account_resolution.sql`

The rollback restores the exact four pre-patch function bodies and comments.
It does not delete or rewrite settlements, journals, audit rows, or idempotency
rows and does not reissue grants.

## Deferred

1. Replace global `accounts.no` uniqueness with
   `UNIQUE(company_id, no)` and provision a canonical chart per company
   (Phase 3A-2).
2. Replace global `owner_settlements.request_id` uniqueness with a
   company-relative constraint; the RPC already namespaces its idempotency key,
   but the legacy row constraint still rejects a shared raw ID loudly.
3. Settlement period-overlap/source-claim policy.
4. Any Production migration application or data repair.

## Production safety

No Production mutation was performed. Live access during inventory was
read-only; implementation and lifecycle proofs ran in ephemeral PGlite.
