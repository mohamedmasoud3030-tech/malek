# S03 — Canonical GL Posting API & Account-Resolution Runbook

**Stage:** S03 — Canonical GL, chart of accounts and accounting periods  
**Purpose:** operational contract for server-side posting, reversal, period resolution and company-scoped account resolution.  
**Source of truth:** the tested SQL functions in `supabase/migrations/20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql` and `20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql`, plus the forward S03 receipt cutover migrations.

## 1. Hard boundary

The browser never posts arbitrary debit/credit lines and never mutates `public.accounts`, `public.journal_batches` or `public.journal_lines` directly.

Business RPCs must:

1. derive the caller/company context server-side;
2. validate the business event and calculate the financial lines server-side;
3. resolve account ids inside the caller's company;
4. call the canonical GL engine from a trusted server/SECURITY DEFINER context;
5. use a stable business `event_id` for idempotency;
6. use `reverse_journal_batch()` for canonical financial reversal rather than deleting or rewriting posted history.

`authenticated` and `anon` do not receive EXECUTE on the engine functions. `service_role` is the engine execution role.

## 2. Canonical posting signatures

### `public.post_journal_event(p_payload jsonb) -> jsonb`

Preferred create+post boundary for a predefined business event.

Required payload fields:

- `company_id`
- `source_type`
- `source_id`
- `event_id`
- `effective_date`
- `lines`

Each line must contain `account_id` and exactly one positive side: `debit` XOR `credit`. Optional trace fields are `line_description`, `ref_source_id`, `ref_entity_type`, and `ref_entity_id`.

The engine rounds to OMR 0.001, validates every account against `company_id`, requires total debit = total credit, creates a DRAFT batch, resolves the accounting period, and posts it atomically.

Idempotency key is enforced by the database identity:

`(company_id, source_type, source_id, event_id)`

A retry with identical financial content returns the existing posting. The same event identity with materially different account/amount content fails with `GL_EVENT_CONFLICT` / SQLSTATE `23505`.

### `public.gl_create_journal_batch(p_payload jsonb) -> jsonb`

Low-level trusted-server DRAFT creator. Use only where a multi-step server workflow genuinely requires an explicit DRAFT before posting. It has the same metadata/line validation as `post_journal_event` and is not a browser API.

### `public.gl_post_journal_batch(p_batch_id uuid) -> jsonb`

Posts one validated DRAFT batch. It locks the batch, checks non-empty/balanced lines, resolves the accounting period server-side, records posting metadata and transitions to POSTED. Re-posting an already POSTED batch is idempotent.

### `public.reverse_journal_batch(p_batch_id uuid) -> jsonb`

Canonical equal-and-opposite reversal. It creates one linked POSTED reversal batch, sets `reversal_of_batch_id`, preserves the original business effective date, applies current period-resolution rules, and marks the original batch REVERSED. Retrying an already-reversed batch returns the existing reversal.

No caller should manufacture reversing debit/credit lines for a canonical batch.

## 3. Period contract

`public.gl_resolve_accounting_period(company_id, effective_date)` applies this order:

1. OPEN period containing `effective_date`;
2. otherwise the earliest eligible OPEN period whose end date is not before the event date;
3. otherwise fail with `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD` / `P0001`.

For canonical POSTED batches:

- `effective_date` always remains the original business event date;
- normal posting: `late_posting=false`, `posting_date=effective_date`;
- redirected late event: `late_posting=true`, `posting_date` is the receiving OPEN period start date;
- a missing `period_resolution_reason` never produces a NULL `late_posting` value.

`gl_ensure_initial_open_period(company_id, anchor_date)` is an internal bootstrap used by the first receipt/payment cutover only when a company has **zero** accounting periods. Once any period exists, normal accounting-period governance is authoritative and the helper does not reshape it.

## 4. Account-resolution contract

Account identity is `(company_id, account_no)`, never a global account number.

Approved boundaries:

- `ensure_company_chart_of_accounts()` — authenticated ADMIN/MANAGER provisioning facade; company comes from the JWT, not client input.
- `provision_company_chart_of_accounts(company_id)` — trusted server/service-role provisioning primitive.
- `ensure_company_account(company_id, account_no, account_name)` — trusted server helper for deterministic company-scoped creation where an approved business flow needs it.
- `require_company_account_id(company_id, account_no)` — trusted server resolver for an already-required account; business postings should prefer this fail-closed resolver.

The browser may SELECT tenant-scoped rows from `public.accounts`, but direct INSERT/UPDATE/DELETE is denied even for ADMIN. Never restore `admin_write_accounts` in normal operation.

## 5. Stable engine errors

| Condition | Error marker | SQLSTATE |
|---|---|---|
| Browser/untrusted engine call | `GL_ENGINE_SERVER_ONLY` | `42501` |
| Missing event metadata | `GL_EVENT_METADATA_REQUIRED` | `22023` |
| Missing batch metadata | `GL_BATCH_METADATA_REQUIRED` | `22023` |
| Empty line set/batch | `JOURNAL_BATCH_EMPTY` | `22023` |
| Account missing/outside company | `JOURNAL_LINE_ACCOUNT_SCOPE` | `22023` |
| Debit and credit both set, or neither set | `JOURNAL_LINE_SIDE_INVALID` | `22023` |
| Negative debit/credit | `JOURNAL_LINE_NEGATIVE_INVALID` | `22023` |
| Debit != credit after 0.001 rounding | `JOURNAL_BATCH_UNBALANCED` | `P0001` |
| Same event id with different financial content | `GL_EVENT_CONFLICT` | `23505` |
| Event already reversed | `GL_EVENT_ALREADY_REVERSED` | `P0001` |
| No eligible OPEN period | `NO_ELIGIBLE_OPEN_ACCOUNTING_PERIOD` | `P0001` |
| Missing batch id | `GL_BATCH_ID_REQUIRED` | `22023` |
| Batch not found | `GL_BATCH_NOT_FOUND` | `P0002` |
| Reversed/invalid batch state | `GL_BATCH_REVERSED` / `GL_BATCH_STATE_INVALID` | `P0001` |

Business RPCs may expose their own domain errors before entering the engine; they must not weaken these GL guarantees.

## 6. Current Stage-3 rollout state

Canonical live cutover already covered in S03:

- receipt/payment posting -> `post_journal_event`;
- receipt VOID -> `reverse_journal_batch` for canonical receipts;
- legacy historical receipts retain a compatibility fallback without rewriting old history;
- `journal_entries` remains a read-compatibility projection for existing readers.

Other legacy business writers are **not automatically declared canonical** merely because they can write through `journal_entries`. Their business accounting belongs to later owning stages (owner agency, expenses/deposits/fees, master lease). They must be migrated only after their stage-specific posting semantics are approved, then use this API contract and stable event ids.

This prevents S03 from freezing obsolete business accounting merely to remove the compatibility path early.

## 7. Verification map

- `rentrix-app/src/s3/stage3-posting-engine.test.ts` — create/post/idempotency/conflict/balance behavior.
- `rentrix-app/src/s3/stage3-periods-reversal-security.test.ts` — period lifecycle, late posting, reversal and server-only security.
- `supabase/tests/stage3_gl_core.sql` — database-level pgTAP balance, RLS, period, reversal and compatibility assertions.
- `rentrix-app/src/s3/stage3-receipt-business-posting.test.ts` — first live receipt/payment canonical batch and idempotent replay.
- `rentrix-app/src/s3/stage3-receipt-void-engine.test.ts` — linked engine-managed receipt reversal.
- `supabase/tests/release_lifecycle_rehearsal.sql` — payment/receipt/VOID compatibility lifecycle.
- `rentrix-app/src/s3/stage3-account-write-boundary.test.ts` — tenant-scoped account reads, RPC provisioning and direct browser-write denial.

## 8. Operational rule for the next stages

When migrating a later business writer, do not copy its old journal loop blindly. First verify its stage-specific accounting matrix. Once approved, derive its entries server-side and map:

- `source_type` = stable business event class;
- `source_id` = stable business aggregate/source id;
- `event_id` = caller/request event id bound to that business mutation;
- `effective_date` = original business date;
- line references = drill-down ids only, never authority for accounting amounts.

Then prove: company isolation, one batch under retry/concurrency, OMR 0.001 balance, closed-period routing, reversal linkage and compatibility/read behavior before merging.
