# Code Review — Business Document References Migration

**File:** `supabase/migrations/20260805000000_business_document_references.sql`  
**Verified against:** `main@f8e5556315b2ad2e76cfdd2a84431438e0932543`  
**Verdict:** Accepted on current volumes with follow-up hardening; not “exceptional/production-ready” without qualification.

## Confirmed strengths

- Company/year/document-type sequence key.
- Atomic `INSERT ... ON CONFLICT DO UPDATE` counter allocation.
- Server-side references and additive columns.
- No `MAX(...) + 1` sequence generation.
- Partial company/reference indexes preserve archived history.
- Existing UUID primary keys remain internal identifiers.

## Confirmed risks

### 1. Missing explicit company context fails open for references

`assign_document_reference()` falls back to a singleton lookup and returns `NEW` unchanged when no company is resolved. That permits a newly inserted business document to remain without a reference. For audited document classes, this should fail closed once legacy compatibility is retired.

### 2. Search path should match hardened house standard

`next_document_reference()` and `assign_document_reference()` use:

```sql
set search_path = public
```

The project’s hardened convention is `public, pg_temp`. A forward-only follow-up should align active function definitions; do not rewrite the historical migration.

### 3. Historical backfill is row-by-row

The migration loops over records and calls the sequence function per row. That is acceptable for the verified small dataset, but no evidence supports claims about millions of rows. Before a large deployment:

- benchmark on production-like volume;
- estimate lock/WAL duration;
- decide whether a set-based backfill can preserve the exact sequence contract;
- perform it in a separately reviewed migration/rehearsal.

### 4. Explicit references are accepted without a domain-level retry token

The trigger skips generation when `NEW.reference` is supplied. That is useful for controlled backfill/compatibility, but it is not general request idempotency. Uniqueness prevents duplicates; it does not prove a retry represents the same business event. Client-facing write paths should continue using their own immutable request/event IDs.

## Corrections to the previous review

- `SET search_path = public` is pinned, so temporary-schema resolution is not automatically open; adding `pg_temp` is alignment with the repository hardening standard, not proof of a current exploit.
- Green migration/CI gates do not prove high-volume performance.
- “Full exception safety” was overstated. Catching `duplicate_table` is replay convenience, not a universal correctness guarantee.

## Follow-up

Use a new forward migration to:

1. redefine active reference functions with `search_path = public, pg_temp`;
2. fail closed for audited inserts when company context cannot be resolved, after compatibility review;
3. add runtime tests for concurrent reference allocation and cross-company uniqueness;
4. retain the historical migration unchanged.
