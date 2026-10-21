# ADR 0019 — RC1 release scope: OWNER_AGENCY only, MASTER_LEASE deferred

Status: **APPROVED — Product Owner decision, 2026-10-21**
Date: 2026-10-21
Applies to: **Release Candidate 1 scope, `GAP-012`, `WP-04`, release claims in Documents 7/8**

## Context

At `129b538` the repository carries 23 open gaps, 18 of them release-blocking. Inspecting them by
*what actually unblocks each one* (rather than by work package) gives:

- **9 gaps need a hosted environment or live evidence** (GAP-003, 013, 014, 015, 016, 017, 020, 021, 022);
- **2 gaps need an external/legal decision** (GAP-019, and the S08 accounting approval gating S09);
- **11 gaps are already engineering-complete in the repository**;
- **1 gap is genuinely not implemented**: GAP-012, MASTER_LEASE. Document 7 states "S06 DB/TypeScript
  kernels; no complete UI/service/reports", and a repository scan at `129b538` finds `gl_ml_*` SQL
  functions in `20260901000000_canonical_baseline.sql` but **no** `malek-app/src/**/s6` module and no
  master-lease UI, service or report surface.

Document 8 already makes WP-04 depend on an "explicit release inclusion decision". Without that
decision the programme is unbounded: a full MASTER_LEASE module (lease measurement, remeasurement,
discount rates, sublease receipts, reports) has real IFRS-16-style accounting semantics that cannot be
invented by an agent (`AGENTS.md`: never invent an accounting rule to unblock yourself).

## Decision

RC1 is scoped to **OWNER_AGENCY** operations. **MASTER_LEASE (GAP-012) is explicitly excluded** from
RC1 and recorded as deferred rather than partially delivered. GAP-012 stays open in Document 7 and
remains release-blocking for any *later* release that includes master-lease operations; it is
non-blocking *for RC1 only because RC1 makes no master-lease claim*.

Consequently, for RC1:

1. No routine UI may present master-lease creation or operation as available.
2. Release notes and any readiness statement must name the exclusion explicitly.
3. S08/S09 historical correction remains gated behind the accounting sign-off required by `REL-004`;
   deferring MASTER_LEASE does not relax that gate.

## Alternatives rejected

- **Include MASTER_LEASE in RC1.** Rejected: requires accounting policy input on measurement and
  remeasurement, a complete UI/service/report chain, and its own reconciliation evidence — none of
  which can be fabricated here. Shipping a partial module would be a false readiness claim.
- **Mark GAP-012 "resolved by exclusion".** Rejected: Document 7 statuses describe product reality;
  excluding a module from a release does not make its gap disappear. It stays open and dated.
- **Remove the module's database kernels.** Rejected: `gl_ml_*` is working, tested SQL; deleting it
  would destroy evidence and future optionality for no benefit.

## Consequences

- The critical path for RC1 is WP-01 → WP-02/WP-03 → WP-05 → WP-06 → WP-07, with no WP-04.
- The honest RC1 claim becomes "owner-agency rental management, end to end", which is defensible.
- A future MASTER_LEASE release re-opens GAP-012 and requires its own ADR superseding this scope for
  that module.

## Evidence

- Document 7 gap register at `129b538` — GAP-012 row: "S06 DB/TypeScript kernels; no complete UI/service/reports".
- `supabase/migrations/20260901000000_canonical_baseline.sql` — `gl_ml_*` functions present.
- Repository scan at `129b538` — no `src/s6`, no master-lease feature directory.
- `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md` — WP-04 depends on "explicit release inclusion decision".
- `docs/advisory/2026-10-21-delivery-consultation-ar.md` §4 — scope comparison that recommended this option.
- Owner instruction in session, 2026-10-21: implement all open items and take defensible decisions
  directly, stopping only where a genuine owner/accounting/legal decision is required.
