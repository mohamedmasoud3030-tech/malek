# ADR 0004 — Proration and Billing Basis Standards
**Date**: 2026-07-24  
**Status**: Approved

---

## 1. Context

Rentrix’s landlord settlements are calculated khadmi-side (server-side) via `calculate_owner_net_payout()`. Commission calculations for `FIXED_MONTHLY` agreements and master lease obligations currently calculate complete months: any partial overlap with a calendar month results in a full month fee (Month Count Basis).

Some clients in Oman and the GCC may demand precise daily proration (Day Basis) for agreements that do not span a full calendar month.

---

## 2. Decision

We decide to **preserve the Full Calendar Month/Covered Month as the default billing standard**. We reject changing the default behavior silently because:
1.  It would alter historical financial statements and accounting reports for existing contracts.
2.  It violates GAAP and local compliance standards unless explicitly agreed upon in the landlord covenant.

### Additive Extension Policy
To support day-basis daily proration in the future, we will introduce a new, optional column on the `owner_agreements` table:
`billing_basis text not null default 'FULL_MONTH' check (billing_basis in ('FULL_MONTH', 'DAILY_PRORATED'))`

*   `FULL_MONTH`: Accrues the full month fee for any overlapping day.
*   `DAILY_PRORATED`: Accrues a fraction of the monthly fee, calculated as: `(monthly_value / days_in_month) * days_covered_in_period`.

No legacy agreements or calculations are modified silently.
