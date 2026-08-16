# ADR 0017 — RC1 Product-Scope Closeout Decisions

Status: **APPROVED — Product Owner delegation for final closeout**  
Date: 2026-08-16  
Applies to: **MALEK RC1 / PR #1471**

This record closes the Product-Owner-owned scope decisions that were left open
in ADR 0016. It does **not** invent accounting policy, legal approval, live
deployment evidence, pilot evidence, or accountant sign-off.

## Decision A — MASTER_LEASE is excluded from RC1

**Decision:** EXCLUDE the independent MASTER_LEASE principal-accounting module
from RC1.

The existing `gl_ml_*` kernels, migrations and tests remain preserved in the
repository. RC1 must not expose navigation, dashboards, reports or copy that
implies the module is available or IFRS-complete. MASTER_LEASE can return in a
later governed release after its full product journey and professional review
are complete.

**Effect:** DP-1 is closed for RC1 by explicit exclusion. GAP-012 is not a
release blocker for the RC1 included scope, but the module itself remains
unfinished/deferred.

## Decision B — RC1 onboarding scope is the current five-step operating order

**Decision:** RC1 adopts the existing backend-driven five-step operating order
as the canonical onboarding scope for the first single-office release:

1. Owner / authority identity
2. Property record
3. Unit record
4. Contract setup
5. Invoice / operating readiness

Owner/authority identity and property identity remain NON_WAIVABLE. The later
seven-step/property-type expansion and any jurisdiction-specific safety/legal
evidence model are deferred until an explicit follow-up Product Owner decision
and, where applicable, Oman legal review.

This is a release-scope decision, not a legal-sufficiency claim. The implemented
server-side completion rules, company-scoped templates, audited waivers,
revoke/reset history and fail-closed activation controls remain authoritative.

**Effect:** DP-5 is closed for RC1. The future seven-step catalog is a deferred
product enhancement, not an RC1 blocker. GAP-019 legal-template validity
remains external.

## Decision C — Unmapped adjustment event types are excluded from RC1

**Decision:** RC1 includes only adjustment/reversal events with an already
approved canonical accounting mapping and working governed implementation.
Included examples are receipt VOID, invoice credit note where already mapped,
deposit refund/reversal, commission reversal, owner-receivable recovery/offset
reversal, and contract termination behavior already covered by canonical
accounts.

The following remain explicitly unavailable/fail-closed in RC1 until an
Accountant approves their chart-of-accounts and tax treatment:

- late fees / other-charge revenue,
- general non-deposit cash refunds where no canonical mapping exists,
- non-cash adjustments where no canonical mapping exists.

No new revenue/contra-revenue account is invented and FIN-014's canonical chart
is not changed by this decision.

**Effect:** DP-4 remains an accounting decision for a future release, but it is
not an RC1 release blocker because the unmapped event types are explicitly out
of scope and must remain fail-closed.

## Decisions that remain external

- Oman production legal-template approval (ADR 0016 DP-3 / GAP-019).
- Exact deployed Supabase/Auth/RLS/Storage/backup-restore verification.
- Real one-office operating-period pilot evidence.
- Accountant/legal/pilot sign-offs required by the final production gate.

## Release-governance consequence

For RC1, release gates and traceability must evaluate the **included scope**.
An excluded capability is not considered implemented, but it also must not be
counted as a release blocker if every UI/API/database path fails closed and the
product does not claim availability.
