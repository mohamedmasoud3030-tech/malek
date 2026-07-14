# Owner Settlement Workflow — Gap Analysis & Business Decisions

> Archived on 2026-07-14. The decisions requested by this review were resolved by `docs/decisions/0001-product-accounting-policies.md`; use that decision record and `docs/NEXT.md` for implementation work.

Scope: P0-3 of the Final Gap Closure. Reviewed the existing implementation; did
**not** rebuild it. The settlement workflow is partially present (a table and a
read-only statement RPC), but the operational lifecycle is **not** wired. The
missing pieces are business-rule driven, so they are recorded here as decisions
to be made — not implemented — per the task rule "any part needing a business
decision: don't implement, record only."

## Required cycle (per task)

```
Collected Rent → Management Fee → Maintenance Deduction → Owner Payable →
Approval → Payment → Owner Statement
```

## What exists today (verified from code/migrations)

| Step | Exists? | Evidence |
| --- | --- | --- |
| Collected Rent | ✅ | `payments` / `receipts` per contract; `rpt_owner_statement` reads receipts |
| Management Fee (rate) | ⚠️ partial | `owners.commission_type` / `commission_value` used as a *display* deduction inside `rpt_owner_statement` only |
| Maintenance Deduction | ⚠️ partial | `expenses` with `charged_to = 'OWNER'` are read into the owner statement |
| Owner Payable (net) | ❌ stored | No `owner_settlements` rows are ever written; net is computed ad-hoc in the RPC |
| Approval | ❌ | No approval state machine exists |
| Payment | ❌ | `owner_settlements` table exists (status `PENDING`/`PAID`/`CANCELLED`) but nothing writes to it |
| Owner Statement | ✅ read-only | `rpt_owner_statement(p_owner_id, p_from, p_to)` |

## Missing pieces (record as business decisions)

1. **Settlement creation job** — a periodic (monthly) process that, per owner/property,
   aggregates collected rent − management fee − owner-charged maintenance and
   writes an `owner_settlements` row. **Decision needed:** cadence (per-contract vs
   per-owner rollup), and whether settlements are created automatically or drafted
   for review.
2. **Management fee computation** — currently only a flat `RATE` (% of gross) is
   modelled in the statement. **Decision needed:** support fixed-amount fees,
   tiering, VAT treatment of the fee, and exclusions (deposits/refunds/pass-through
   utilities) — these are tracked in `docs/NEXT.md` product/accounting items 1–2.
3. **Approval workflow** — an `APPROVED` state and an approver/role gate before a
   settlement can move to `PAID`. **Decision needed:** which role approves
   (manager/admin), and whether partial approvals are allowed.
4. **Payment of settlement** — a `PAID` transition that records the payout
   (method, reference) and feeds the balance sheet `Owner Payables` line. **Decision
   needed:** payout method(s), bank-account linkage, and audit evidence.
5. **Statement ↔ settlement link** — `rpt_owner_statement` currently unions
   receipts/expenses/settlements; it should present the *approved/paid* settlement
   as the authoritative owner payable rather than re-deriving net each run.

## Why not implemented now

Each item above changes financial state and depends on product/accounting policy
that is not yet decided (see `docs/decisions/0001-product-accounting-policies.md`
and `docs/NEXT.md`). Implementing them without those decisions would invent
business rules and risk `financial integrity`, which the task explicitly requires
preserving. The table, RLS (`FORCE ROW LEVEL SECURITY` on `owner_settlements`),
and the read-only statement RPC are intact and safe to keep.

## Recommended next step

Once the five decisions above are confirmed, implement them as one atomic
settlement RPC (mirroring `record_invoice_payment_atomic` / the new
`create_expense_with_journal_atomic`) that writes the settlement, posts the
owner-payable journal entry, and audits the action in a single transaction.
