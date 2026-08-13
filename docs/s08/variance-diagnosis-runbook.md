# Subledger↔GL variance diagnosis runbook (WP-05 GAP-018)

How to go from "a reconciliation class is FAIL" to "Accounting has decided what
to do about it", without any unapproved money movement.

Related: [`docs/s08/operational-runbook.md`](./operational-runbook.md),
[`docs/s08/schema-mapping.md`](./schema-mapping.md),
[`evidence/wp05/gap018/README.md`](../../evidence/wp05/gap018/README.md).

## The chain

```
wp05_reconcile_all            → PASS/FAIL per class          (GAP-013, unchanged)
wp05_variance_diagnostics     → reason code + evidence        (GAP-018, read-only)
wp05_generate_correction_proposals → PENDING_APPROVAL rows    (GAP-018, maker)
wp05_approve/reject_correction_proposal → decision            (GAP-018, checker)
s08_create/analyze/approve_frozen_review → frozen review      (GAP-015)
s09_create_correction_draft → validate → apply                (GAP-016, the ONLY posting path)
```

Only the last step touches the general ledger, and it is already gated on an
`APPROVED` S08 review. Everything GAP-018 adds sits *before* that gate.

## Step 1 — diagnose (read-only, safe at any time)

```sql
select reconciliation_class, account_no, subledger_balance, gl_balance,
       variance, reason_code, proposal_type, recommended_action
from public.wp05_variance_diagnostics(current_company_id(), date '2026-07-31')
where reconciliation_status = 'FAIL';
```

`evidence` on each row carries the numbers behind the verdict: GL debit/credit
split, line count, whether the account exists in the company chart at all, and
class-specific detail (deposit gross/deducted/refunded, credit-balance invoice
count, open settlement totals, and so on).

### Reason codes

| Code | What it means | Typical fix |
| --- | --- | --- |
| `RECONCILED` | Within the 0.001 tolerance. | None. |
| `GL_ACCOUNT_MISSING_IN_COA` | The account is not provisioned for this company, so the GL side can only read 0.000. | Provision the account, or re-point the class at the account this company actually uses. **Check this first when the GL side is exactly 0.000** — the target architecture specifies 2201/2301 while the provisioned chart uses 2000/2200. |
| `GL_NO_POSTINGS_FOR_ACCOUNT` | Account exists, zero posted lines. The subledger balance was never recognised in the ledger. | Find the business events behind the subledger rows; confirm recognition was skipped rather than routed elsewhere. |
| `SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL` | A subledger reduction (deposit deduction/refund) has no offsetting GL entry, and the unposted amount equals the variance. | Reconstruct the application/refund events. |
| `GL_CONTRA_BALANCE_ON_DEBIT_NORMAL` | A debit-normal account nets to a credit. Credits exceed debits on a receivable. | Review unapplied receipts, collections without an originating invoice, and reversals posted to the wrong side. |
| `SUBLEDGER_OMITS_CREDIT_BALANCE_ROWS` | Over-collected invoices are floored out of the receivables subledger while their GL effect remains. | Decide whether over-collections should be reclassified to a tenant-credit liability. |
| `GL_POSTINGS_WITHOUT_SUBLEDGER_ROWS` | GL moved, the subledger has no qualifying open rows. | Check whether rows were settled without reversing the GL. |
| `SUBLEDGER_SNAPSHOT_NOT_AS_OF` | The source is a running snapshot with no as-of dimension, compared against a GL cut at the as-of date. | Re-run at `current_date`; if the variance disappears it is a cut-off artefact. |
| `UNCLASSIFIED_VARIANCE` | No known signature matched. | Manual accounting review. |

### Known as-of limitation

`owner_balances`, `tenant_deposits` and `commissions` have no as-of dimension in
the GAP-013 helpers, so they are running snapshots compared against a GL balance
that *is* cut at the as-of date. Always re-run at `current_date` before treating
a variance in these classes as a posting defect. The diagnostics surface this
explicitly via `SUBLEDGER_SNAPSHOT_NOT_AS_OF` and the
`*_has_as_of_dimension: false` evidence flags.

## Step 2 — raise proposals (maker: ADMIN or MANAGER)

```sql
select public.wp05_generate_correction_proposals(
  date '2026-07-31',
  'reconciliation-2026-07',              -- request_id, optional
  '<accounting_period_id>'::uuid         -- optional
);
```

One `PENDING_APPROVAL` row per failing class. Idempotent: the identity is
`sha256(company | as_of | class | account | reason_code | variance)`, so re-running
after no change creates nothing (`created: 0`). If the variance *amount* changes,
the identity changes and a new proposal is raised, leaving the old one as history.

The return payload always carries `posted_to_gl: false`.

## Step 3 — decide (checker: ACCOUNTANT or ADMIN, and **not** the maker)

```sql
select public.wp05_approve_correction_proposal('<proposal_id>'::uuid, 'note');
select public.wp05_reject_correction_proposal('<proposal_id>'::uuid, 'reason');   -- reason mandatory
```

Approval does **not** post anything. It records that Accounting accepts the
finding and authorises the S09 route. The database enforces:

- maker ≠ checker (both in the RPC and in the row trigger);
- only `PENDING_APPROVAL` can be decided; decisions are terminal;
- rows are append-only — no deletes, and no direct updates outside the RPCs;
- finding, balances and evidence are immutable after creation;
- rejection requires a non-empty reason;
- every create/approve/reject writes an `audit_log` event
  (`WP05_PROPOSAL_CREATED` / `_APPROVED` / `_REJECTED`).

## Step 4 — only then, correct (unchanged S08→S09 path)

An approved proposal is an input to the existing flow, not a shortcut through it:

1. `s08_create_frozen_review` → `s08_analyze_frozen_review` → `s08_approve_frozen_review`
   (approval is ACCOUNTANT/ADMIN only and re-verifies the dataset fingerprint).
2. `s09_create_correction_draft` → `s09_validate_correction` → `s09_apply_correction`.

`s09_validate_correction` throws `42501` until the linked S08 review is
`APPROVED`, so the gate holds regardless of proposal state.

## Verifying that nothing was posted

```sql
select public.wp05_assert_no_unapproved_correction_postings(current_company_id());
```

`success = true` requires zero GL batches sourced from the proposal lane **and**
zero `APPLIED` S09 corrections whose S08 review is not `APPROVED`. Run it before
and after any diagnosis session.

## Offline verification

Neither script touches a hosted project; both build an ephemeral PGlite database
from `supabase/migrations`:

```
node scripts/wp05/reproduce-variances.mjs      # 11 assertions — variance shapes → reason codes
node scripts/wp05/verify-proposal-controls.mjs # 24 assertions — the control surface
```

pgTAP (`supabase/tests/wp05_gap018_variance_diagnostics.sql`, plan 38) proves the
same properties on real PostgreSQL in the Docker-backed CI lane.
