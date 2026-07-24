# 0006. Company-canonical owner payouts and immutable settlement requests

## Context

The active owner-settlement payout resolved account numbers `2000` and `1111`
with direct `LIMIT 1` queries, while settlement idempotency cached raw responses
without proving that a reused key represented the same target and payload. The
table still has global `accounts.no` uniqueness, but Phase 3A-2 will make account
numbers company-relative.

## Decision

Owner payouts resolve `2000` and `1111` only through
`require_company_account_id(company_id, account_no)`. For create, approve, pay,
and cancel, `request_id` identifies one immutable logical financial request
inside one company, proven by a canonical SHA-256 fingerprint and target stored
in an internal response envelope.

## Alternatives rejected

Keeping direct `accounts.no ... LIMIT 1` lookup was rejected because it is
order-dependent and incompatible with per-company charts. Namespacing only the
idempotency operation was rejected because it isolates companies but still
allows one key to replay a response for a different settlement or payload.
Adding columns to the idempotency table was deferred because the existing JSONB
payload can carry a fail-closed internal envelope without a schema migration.

## Consequences

Missing or ambiguous company accounts fail loudly before settlement mutation.
Replays retain the external response shape, while changed targets/payloads and
unverified cached payloads fail before writes. Phase 3A-2 may relax global
account-number uniqueness without changing payout code. Request
canonicalization is now an API contract and changes require a superseding ADR.

## Evidence

- `supabase/migrations/20260729090000_phase3a1c_owner_settlement_account_resolution.sql`
- `supabase/rollback/20260729_rollback_phase3a1c_owner_settlement_account_resolution.sql`
- `rentrix-app/src/p3/phase3a1c-execution.test.ts`
- `rentrix-app/src/p3/phase3a1c-forward-rollback.test.ts`
- `evidence/p3/phase3a1c/`
- `docs/audits/PHASE3A1C_OWNER_SETTLEMENT_ACCOUNT_RESOLUTION.md`
