# 0010. Stage 3 — General Ledger Core: canonical ledger consolidation

## Status

**APPROVED / IMPLEMENTED (Stage 3)**

## Context

The product's approved accounting model (ADR 0009) fixes:
- `property_management` = AGENT (presentation NET), `master_lease` = PRINCIPAL;
- collection roles `OWNER_IS_CREDITOR` / `OFFICE_IS_CREDITOR`;
- OMR precision = 3 decimals, rounding unit 0.001 (C7 APPROVED).

Before Stage 3 the ledger lived in a single table `journal_entries`
(id/no/date/account_id/amount/type/source/entity columns, nullable
`batch_id`, numeric(14,2)) written directly by ~30 legacy business RPCs and
read by the report RPCs. There was no batch table, no accounting-period
concept, no reversal lifecycle, and account numbers were globally unique
(`UNIQUE(no)`), which made per-company charts impossible.

Stage 3 consolidates the ledger into ONE canonical model without rewriting
any historical migration or any legacy RPC.

## Decision

### 1. Canonical storage model

- `journal_batches` — company-scoped batches with `DRAFT → POSTED → REVERSED`
  lifecycle, business-event traceability (`source_type`, `source_id`,
  `event_id`), resolved `accounting_period_id`, `posted_at`, and a
  database-enforced idempotency key `UNIQUE (company_id, source_type,
  source_id, event_id)`.
- `journal_lines` — immutable lines with exact `numeric(18,3)` debit/credit
  (debit XOR credit, positive, zero/negative rejected by CHECK), company
  consistency enforced by composite FKs `(batch_id, company_id)` and
  `(account_id, company_id)` (the FA-003 pattern), legacy columns
  (`no`, `date`, `request_id`, `deleted_at`, ref_*) preserved for
  compatibility.
- `journal_entries` becomes a **read-only compatibility VIEW**
  (`security_invoker = true`) over the canonical tables, so every existing
  report RPC, legacy business RPC and release rehearsal keeps working
  unchanged. Legacy INSERTs are routed by an INSTEAD OF trigger into
  canonical batches/lines, but only when the caller is a trusted server
  context (`postgres`/`supabase_admin`/`service_role`); browser writes are
  always rejected.
- `journal_entries_archive` — the historical table, renamed and frozen
  (all DML blocked). Every legacy row was backfilled into the canonical
  tables with deterministic grouping (by legacy `batch_id`, else by the
  business-event identity); no posted history is deleted or rewritten
  anywhere. Groups that do not balance (pre-existing anomalies) are marked
  `DRAFT` — the migration never invents balances and never fails on
  populated databases.

### 2. Chart of accounts

- `accounts` upgraded additively: `account_type`, `normal_balance`,
  `currency_code`, `precision`, `is_active`, `updated_at`, with CHECK
  constraints (classification/normal-balance enums, OMR ⇒ precision 3).
- Global `UNIQUE(no)` replaced by `UNIQUE(company_id, no)` after a duplicate
  inspection (fail-closed). Account numbers repeat across companies, never
  within one.
- The legacy `no` column is kept as the account-number column (the project's
  house convention for document numbers); no rename churn.
- `provision_company_chart_of_accounts(uuid)` (service_role) idempotently
  provisions the 18 required accounts per company without ever overwriting
  customized names; `ensure_company_chart_of_accounts()` exposes the same
  boundary to ADMIN/MANAGER with the company derived from the JWT.
- `ensure_company_account` drops the obsolete
  `ACCOUNT_NUMBER_GLOBAL_UNIQUENESS_BLOCKED` guard — the composite unique
  constraint is the protection now.
- Deleting an account referenced by any ledger line (canonical or archived)
  is blocked by a friendly trigger on top of the `ON DELETE RESTRICT` FKs.

### 3. Accounting periods

- `accounting_periods`: `OPEN`, `SOFT_CLOSED`, `HARD_CLOSED`; unique period
  name per company; non-overlap enforced by an advisory-locked trigger;
  DELETE always rejected; direct UPDATEs rejected unless authorized by
  `update_accounting_period_status` (session marker); `HARD_CLOSED` is
  immutable; reopening `SOFT_CLOSED` requires an explicit reason; every
  status change is audited.
- Server-side resolution in the engine: the OPEN period containing the
  effective date wins; otherwise the earliest OPEN period whose end date is
  on/after the effective date receives the batch (`redirected_earliest_open_period`),
  the original `effective_date` is preserved, and `posted_at` is the real
  posting timestamp. No eligible open period ⇒ the posting fails clearly.

### 4. Posting engine (one canonical boundary)

- `gl_create_journal_batch` / `gl_post_journal_batch` / `post_journal_event`
  / `reverse_journal_batch`: SECURITY DEFINER, owned by postgres, pinned
  `search_path`, ACL = service_role only (browser roles have no EXECUTE).
- Validation: company scope, account existence/company/active, exactly one
  positive side per line, canonical `round(x, 3)` normalization, exact
  balance after rounding, empty-batch rejection, closed-period rules,
  idempotent retries (same event ⇒ same batch), conflicts on materially
  different financial data (`GL_EVENT_CONFLICT`).
- Balance is additionally enforced at the database level by DEFERRABLE
  constraint triggers on `journal_lines` and `journal_batches`: any batch
  that ends a transaction POSTED/REVERSED and unbalanced aborts the whole
  transaction.
- Reversal: creates an equal-and-opposite batch referencing the original via
  `reversal_of_batch_id`, marks the original `REVERSED`, follows open-period
  rules, and is idempotent (a second reversal returns the existing one).

### 5. Security

- Restrictive `p0_tenant_isolation` on `journal_batches`, `journal_lines`,
  `accounting_periods` (+ existing `accounts`), read-only permissive
  policies mirroring the historical posture, and no write grants to
  authenticated on any new table.
- Narrow prerequisite repair (pre-existing defect): `is_admin()` was never
  granted EXECUTE to authenticated, so every authenticated SELECT on
  `accounts` failed with "permission denied for function is_admin" (the
  legacy `admin_write_accounts` FOR ALL policy evaluates on SELECT). The
  Stage 3 chart read path depends on account reads, so the helper is granted
  to authenticated — it is SECURITY DEFINER and only reports the caller's
  own role.

## Consequences

- One canonical ledger: batches + lines. Reports keep reading the
  `journal_entries` view; legacy RPCs keep writing through it; new business
  postings (Stage 4+) will call the engine from trusted contexts.
- Stage 4–10 behaviors are intentionally NOT implemented: no
  property-management posting lifecycle, no expenses/deposits/commissions
  workflows, no IFRS 16 schedules, no backfill of historical periods, no
  financial reports beyond the existing operational ones.

## References

- ADR 0009 (canonical accounting model, C7 OMR precision).
- Migrations `20260804030000` / `20260804030100` / `20260804030200`.
- Rollbacks in `supabase/rollback/20260804_rollback_stage3_gl_core_*.sql`.
- Tests: `rentrix-app/src/s3/*.test.ts`, `supabase/tests/stage3_gl_core.sql`.
