# GAP-017 evidence — Bank CSV fail-closed closeout

This lane closes D16 / OPS-014 / GAP-017 only. It does not claim all of WP-05 complete.

## Proven existing controls (kept)

- Client parser is preview-first and fail-closed on missing/ambiguous headers, invalid dates/amounts, non-OMR, >3dp, intra-file exact duplicates.
- `import_bank_statement_batch_atomic` is SECURITY DEFINER, company-scoped, manager-only, 5MB / 5000-row limits, exactly-one amount representation, OMR 3dp, atomic no-partial-write.
- Same fingerprint + same content remains idempotent.
- Staging only: no journal/matching side effects.

## Fixes in this PR

- Server no-write `preview_bank_statement_batch_atomic`.
- `payload_digest` binds fingerprint to canonical content; reused key + different content raises `22023`.
- Import calls preview first, then writes.
- Client parser now rejects amount+debit/credit together (parity with server).
- UI shows Arabic loading/blocked/error/duplicate/completed states and server counts; does not claim full success for zero-accepted results.

## Focused verification

See `commands.txt` in this folder after local runs.

## Merge order

1. Merge PR #1440 (WP-02/GAP-007) first.
2. Update this branch once from latest `main`.
3. Re-run focused bank CSV + replay checks.
4. Merge this PR.
