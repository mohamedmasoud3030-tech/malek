# Arena Handoff — WP-02 Owner-Agency Financial Lifecycle

## Resume point

- Repository: `mohamedmasoud3030-tech/malik`
- Base: `main@894224b8d323d1eacbcf7c571210bb99fbb6f366`
- Working branch: `feat/wp02-fixed-monthly-daily-accrual`
- WP-01 PRs already merged: #1434, #1436, #1437.
- WP-02 slice 1 already merged: #1438.
- Do not recreate or revert those changes.

PR #1438 added `20260813170000_wp02_rate_fee_collection_wiring.sql`. It resolves frozen owner-agreement terms in `record_invoice_payment_atomic`, applies OWNER/OFFICE collection role server-side, recognizes RATE commission from the actual collected amount at OMR 3dp, and keeps collection plus fee in the same receipt GL batch so governed VOID reverses both.

## Canonical scope

WP-02 owns GAP-006 through GAP-011:

1. RATE fee wiring from actual collection — first slice merged; verify and harden only if a critical defect is found.
2. FIXED_MONTHLY daily accrual, catch-up and reversal — implement now.
3. Due-from-Owner recovery and lawful offset, including post-payout refunds.
4. Deposit beneficiary/application/refund/reversal closure.
5. Versioned company tax profile/code snapshots and fail-closed taxable posting.
6. VOID, credit-note, cash-refund, late-fee and termination event matrix.
7. Reconciliation of owner, due-from-owner and deposit subledgers to GL.

Canonical accounting rules:

- Owner-agency is agent-net; managed rent is not office revenue.
- RATE fee is recognized on actual collection.
- FIXED_MONTHLY fee accrues daily over the effective service period.
- FIXED_MONTHLY: Dr 1300 Due from Owners; Cr 4100 Management Fee Revenue; Cr 2100 only from authoritative tax configuration.
- OMR authority is server-side 3dp.
- Posted history is append-only; corrections use reversal/adjustment.
- Browser code must not author journal lines.
- Every financial operation is company-scoped, idempotent and source-traceable.
- Never invent a tax rate, legal offset right or emergency override.

## Immediate Arena assignment — GAP-007

Implement a production-safe FIXED_MONTHLY accrual lifecycle on the working branch.

### Database/backend

Build an engine-owned lifecycle using additive migration(s):

- Resolve eligible current/frozen owner-agreement versions with:
  - `operating_model = OWNER_AGENCY`
  - `commission_type = FIXED_MONTHLY`
  - `commission_recognition_basis = DAILY_ACCRUAL`
- Derive daily fee from the effective agreement/service interval, including partial months and leap/month-length differences.
- Use authoritative OMR 3dp rounding and document the allocation of rounding residue so the month total is exact.
- Support:
  - single-day accrual;
  - bounded catch-up range;
  - idempotent replay;
  - explicit compensating reversal;
  - late posting through the existing accounting-period resolver.
- Persist an immutable accrual ledger keyed by company, agreement version and economic date. Enable RLS on any exposed table; allow browser reads only when genuinely needed and keep writes RPC/engine-owned.
- Post through `post_journal_event`; never insert arbitrary journal lines from the client.
- Link every journal batch to the accrual ledger/source identity.
- Derive tax only from an authoritative company tax configuration that is valid on the economic date. If that versioned authority does not exist yet, fail closed or keep the taxable portion explicitly outside this slice; do not hard-code VAT.
- Reversal must preserve original economic date/source linkage and be idempotent.
- Add a rollback script.

### Service/UI

Add only the minimum product wiring needed to:

- show accrual status, date range, net/tax/gross and reversal state;
- allow an authorized ADMIN/MANAGER/ACCOUNTANT path to request execution through an RPC;
- show actionable Arabic errors;
- avoid direct table mutations or browser-authored accounting.

Do not build a broad redesign.

### Required focused evidence

Cover at minimum:

- a 31-day month;
- February and leap-year behavior;
- agreement starting/ending mid-month;
- catch-up produces the same final total as daily execution;
- replay produces no duplicate economic effect;
- cross-company access fails;
- missing/invalid terms fail closed;
- reversal returns 1300/4100/2100 to the expected balance;
- hard/soft/open period behavior follows the canonical resolver;
- RATE collection behavior from PR #1438 is not regressed.

Use focused tests first. Per owner direction, do not wait more than five minutes on any single broad suite. Do not bypass a migration replay, TypeScript/build failure, unbalanced journal, company-isolation failure, duplicate posting, or destructive-history defect. Secondary slow/browser/infrastructure failures may be documented and deferred.

## Files to inspect first

- `supabase/migrations/20260809010000_s04_property_management_gl_rpcs.sql`
- `supabase/migrations/20260807200000_s04_owner_agreement_versioning.sql`
- `supabase/migrations/20260807203000_s04_contract_agreement_snapshot.sql`
- `supabase/migrations/20260813170000_wp02_rate_fee_collection_wiring.sql`
- `rentrix-app/src/s4/s04-property-management-gl.test.ts`
- `rentrix-app/src/p2/wp02-rate-fee-collection-wiring.test.ts`
- `supabase/tests/property_management_gl_lifecycle.sql`
- `docs/source-of-truth/04_FINANCE_AND_ACCOUNTING_MODEL.md`
- `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`

## Delivery contract

- Work only on `feat/wp02-fixed-monthly-daily-accrual` from the stated base.
- Keep the batch limited to GAP-007.
- Open one non-draft PR to `main`.
- PR body must state what is implemented, what remains in WP-02, migration/rollback names, focused evidence and any deferred non-critical checks.
- Do not claim GAP-007 closed unless the actual daily/catch-up/reversal lifecycle and focused evidence are present.
- Do not deploy or mutate production data.
