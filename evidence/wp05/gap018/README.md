# GAP-018 evidence — Subledger↔GL variance diagnosis and pending-approval corrections

This lane closes the diagnosis and governance half of the three reported
subledger-vs-GL variances. It closes no financial variance by itself: every
finding is left `PENDING_APPROVAL` for Accounting.

## Truth layers (per AGENTS.md, reported separately)

| Layer | Statement |
| --- | --- |
| Canonical rule | OMR is 3dp with a 0.001 rounding unit; corrections to posted history require governed S08 analysis and S09 authorisation. |
| Repository reality | GAP-013 (`20260814040000`) computes PASS/FAIL per class but produces no cause and no route to a decision. GAP-018 adds both, without changing any GAP-013 balance. |
| Governed stage credit | Not claimed. This PR does not mark any stage complete. |
| Runtime verification | **Not performed against the hosted project.** `https://nnggcnpcuomwfuupupwg.supabase.co` and `https://api.supabase.com` both fail the TLS handshake (`curl (35) SSL_ERROR_SYSCALL`) from this environment, and no database password was supplied. All results below come from an ephemeral PGlite replay of `supabase/migrations` and from pgTAP. |

## The three reported variances

| Class | Subledger | GL | Variance | Reason code | Proposal type |
| --- | ---: | ---: | ---: | --- | --- |
| Owner Payables (2000) | 12,405.000 | 0.000 | +12,405.000 | `GL_NO_POSTINGS_FOR_ACCOUNT` | `MISSING_GL_POSTING` |
| Security Deposits (2200) | 50.000 | 100.000 | −50.000 | `SUBLEDGER_MOVEMENT_NOT_POSTED_TO_GL` | `MISSING_GL_POSTING` |
| Tenant Receivables (1201) | 3,100.000 | −7,230.000 | +10,330.000 | `GL_CONTRA_BALANCE_ON_DEBIT_NORMAL` | `INVESTIGATE_ONLY` |

Each figure above is **reproduced structurally**, not read from production. The
harness seeds only schema-valid source records, posts GL exclusively through the
canonical `post_journal_event` kernel, and then asks the classifier what it sees.
A shape that reproduces the reported numbers and lands on a specific reason code
is a defensible hypothesis about the live cause; it is not a live measurement.

### What each shape means

- **Owner Payables** — `owner_balances.net_balance` carries the payable, but
  account 2000 has *zero* posted journal lines up to the cut-off. The owner
  payable was recognised operationally and never in the ledger. Note that
  `docs/audits/TARGET_PRODUCT_ARCHITECTURE_20260724.md` specifies 2201 for Owner
  Payables while the provisioned chart and GAP-013 both use 2000; if the live
  company's chart follows the target numbering, the same symptom is produced by
  account-code drift and the classifier reports `GL_ACCOUNT_MISSING_IN_COA`
  instead. Both branches are implemented and distinguished by COA presence.
- **Security Deposits** — a 100.000 deposit was received and credited to 2200,
  then 50.000 was deducted in `tenant_deposits`. The application never emitted
  the offsetting debit, so the liability stayed at 100.000 while the subledger
  fell to 50.000. The evidence payload carries `deposit_applied_total` = 50.000,
  which equals the variance exactly.
- **Tenant Receivables** — 1201 is debit-normal but nets to a credit because
  collections were posted straight to 1201 without an originating invoice debit
  (3,100.000 of debits against 10,330.000 of credits). The subledger, which
  floors outstanding amounts at zero, cannot see the contra side at all.

## Files

| File | Contents |
| --- | --- |
| `variance-reproduction.json` | Full reconciliation + diagnostics output for the reproduction, the control company, the no-unapproved-posting proof, and 11 assertions. |
| `proposal-controls.json` | 24 control assertions over the proposal lane: role gates, maker≠checker, idempotency, immutability, isolation, and no GL posting. |

Regenerate both with:

```
node scripts/wp05/reproduce-variances.mjs   --json evidence/wp05/gap018/variance-reproduction.json
node scripts/wp05/verify-proposal-controls.mjs --json evidence/wp05/gap018/proposal-controls.json
```

Both are deterministic: the same migration chain produces byte-identical results
apart from generated UUIDs and timestamps.

## Proof that nothing was posted

`public.wp05_assert_no_unapproved_correction_postings(company_id)` returns
`success = true` only when:

1. no `journal_batches` row for the company has `source_type` in
   (`wp05_correction_proposal`, `wp05_variance_correction`) — the proposal lane
   never appears as a GL source; and
2. every `APPLIED` `s09_corrections` row traces to an S08 review whose
   `reviewer_decision = 'APPROVED'`.

Both reproduction runs report `success: true`, `proposal_sourced_gl_batches: 0`.
Independently, the migration `20260816090000` contains no reference to
`post_journal_event` or `reverse_journal_batch` anywhere in the file, and the
control harness asserts that approving a proposal creates zero journal batches
and zero S09 corrections.

## What still requires a human

- **Live confirmation of all three causes.** The reproduction demonstrates that
  each shape *can* produce the reported numbers; only a read against the hosted
  project confirms that it *did*. Delegate to `supabase-live-readiness.yml` /
  `hosted-qa-verification.yml`, or run `wp05_variance_diagnostics` from the
  Supabase SQL editor.
- **Every correction.** All proposals are `PENDING_APPROVAL`. Approval only
  authorises Accounting to open an S09 correction against an approved S08 frozen
  review; it posts nothing.
- **Supabase Leaked Password Protection** must be enabled manually in
  Dashboard → Authentication → Settings. It is not reachable from any migration.
