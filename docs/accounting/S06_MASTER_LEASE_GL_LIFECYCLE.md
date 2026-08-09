# S06 — Master Lease GL Lifecycle

**Status:** implementation contract for Stage S06  
**Normative parent:** `docs/adr/0010-accounting-legal-reference.md`  
**GL engine:** `docs/accounting/S03_GL_POSTING_API_RUNBOOK.md`

## Scope

`master_lease` is the office-as-**PRINCIPAL** model. It is isolated from owner-agency settlements and never uses `2000 Owner Funds Payable` to represent the head-lease obligation.

S06 persists an immutable measurement history and derives the liability/ROU schedule server-side. The browser never submits journal lines and cannot mutate master-lease accounting tables directly.

## Account map

The Stage 3 chart already provides the primary master-lease accounts:

- `1600` — Right-of-Use Asset
- `2500` — Lease Liability
- `4000` — Sublease Rental Revenue
- `6200` — ROU Depreciation Expense
- `6300` — Lease Interest Expense

The merged S06 calculation kernel also requires three supporting accounts, provisioned additively by the S06 migration:

- `1650` — Accumulated ROU Depreciation — asset / **credit** normal balance (contra-asset)
- `4400` — Lease Modification / Termination Gain — revenue / credit
- `6400` — Lease Modification / Termination Loss — expense / debit

Existing account rows are never overwritten. If one of these numbers exists with incompatible accounting semantics, S06 fails closed.

## Initial measurement and recognition

The service receives commercial measurement inputs, not debit/credit lines. It validates a payment series `{period, amount}`, the annual discount rate in basis points, the periods-per-year frequency, direct costs, incentives and prepayments.

For a recognized lease it computes the present value and creates an immutable DRAFT measurement plus schedule. Posting then uses the canonical GL engine:

```text
Dr 1600 Right-of-Use Asset
  Cr 2500 Lease Liability
  Cr/Dr 1111 or 1120 for the net direct-cost/prepayment/incentive difference
```

OMR amounts are stored and posted at `numeric(18,3)` / 0.001 precision.

## Period posting

For every active period, posting is sequential and idempotent:

```text
Interest:
Dr 6300 Lease Interest Expense
  Cr 2500 Lease Liability

Payment:
Dr 2500 Lease Liability
  Cr 1111/1120 Cash or Bank

ROU depreciation:
Dr 6200 ROU Depreciation
  Cr 1650 Accumulated ROU Depreciation
```

All three components can be carried by the same canonical business-event batch. The S03 engine enforces balance, company scope, accounting periods, OMR precision and event idempotency.

## Short-term election

A short-term election is allowed only when the supplied schedule does not exceed 12 months. No ROU asset or lease liability is recognized in that path. Scheduled lease payments are expensed to `6100 Company Operating Expense` against cash/bank.

## Remeasurement and modification

A modification is measured only at a **posted schedule boundary**. This is deliberate: S06 does not invent mid-period accrued interest.

Carrying liability and carrying ROU are read from the posted old schedule; callers cannot provide them. The new measurement is append-only and references the superseded version.

For a normal remeasurement, the liability delta adjusts the ROU carrying amount. Future depreciation is rebased to the new ROU carrying amount rather than being incorrectly tied to the new liability.

For a partial termination, the engine proportionally derecognizes the carrying liability and ROU, recognizes the resulting gain/loss, and then remeasures the remaining liability. A 100% scope reduction is a full termination and must have no revised payment schedule.

Posting uses signed movements in:

- `1600` ROU Asset
- `2500` Lease Liability
- `4400` termination gain, when applicable
- `6400` termination loss, when applicable

The old measurement becomes `SUPERSEDED`; a full termination closes the lifecycle as `TERMINATED`. Posted history is not rewritten.

## Sublease revenue and vacancy

A tenant contract linked to a `master_lease` agreement posts collected sublease rent as PRINCIPAL revenue:

```text
Dr 1111/1120 Cash or Bank
  Cr 4000 Sublease Rental Revenue
```

No `2000 Owner Funds Payable` line is created. Therefore vacancy naturally produces no sublease revenue while the head-lease interest/payment/depreciation lifecycle continues, making the economic loss visible to the office.

## Security and audit boundaries

- `authenticated` can read only its company-scoped measurements/schedules.
- `authenticated` and `service_role` have no direct INSERT/UPDATE/DELETE table grants.
- Service-role business RPCs are `SECURITY DEFINER`; internal schedule writers are not exposed as service-role APIs.
- Financial fields and derived schedule rows are immutable after insertion.
- Corrections to posted GL use the canonical `reverse_journal_batch()` doctrine from S03; posted journal history is never deleted.
- The S06 rollback refuses to drop the lifecycle tables if any measurement exists.

## Verification

- `supabase/tests/master_lease_gl_lifecycle.sql` — DB/RLS/ACL/precision/GL contract.
- `rentrix-app/src/s6/s06-master-lease-gl-contract.test.ts` — migration architecture contract.
- Existing `rentrix-app/src/s6/*` unit/integration tests — classification, measurement, schedule, remeasurement, termination, disclosures and balanced posting intents.

Production activation remains subject to the external accounting/legal approval gate in ADR-0010.
