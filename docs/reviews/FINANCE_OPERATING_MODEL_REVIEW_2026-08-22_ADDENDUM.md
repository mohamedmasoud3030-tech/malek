# MALEK Finance Operating Model Review — Addendum

> **Date:** 2026-08-22  
> **Baseline:** `main@0a55f4ff3d6d7da75956e8ec53748e1bf2e242d7`  
> **Companion review:** `docs/reviews/FINANCE_OPERATING_MODEL_REVIEW_2026-08-22.md`  
> **Purpose:** record additional defects found while re-checking the product against the locked business/accounting constitution.

## FOM-009 — Dashboard `net_cash` was presented as a full cash position — HIGH — corrected

The authoritative dashboard test proves that the current `net_cash` field is calculated as period collections minus recorded expenses. It is a useful operational delta, but it is not a complete Cash/Bank position and not office profit. Other governed cash/bank movements can exist outside that narrow pair of sources.

The dashboard nevertheless labelled the KPI `صافي النقد` and described it as the office cash position.

**Correction:** the dashboard now labels it `فرق التحصيل والمصروفات` and explicitly states that it is collections minus recorded expenses only, not office profit and not a complete cash-flow statement.

The same misleading wording was also removed from the Reports workspace KPI and analytics overview.

## FOM-010 — Contract payment preview divided the canonical per-cycle rent amount — CRITICAL PRODUCT TRUTH — corrected

The locked business constitution defines:

`rent_amount = قيمة الدفعة التعاقدية الواحدة حسب دورة الدفع`

The previous frontend preview instead calculated:

`amountPerInstallment = rentAmount / installmentCount`

That made the draft-review screen disagree with the server billing model. For example, a one-year monthly contract whose contractual per-cycle amount is 1,200 could be previewed as 100 per cycle even though the server billing path treats `rent_amount` as the cycle invoice amount.

The canonical billing integration test independently proves that the recurring generator creates the period invoice using the contract `rent_amount` value and derives issue/due dates from the contract billing policy.

**Correction:**

- `calculateContractSchedulePreview` no longer divides `rent_amount` by contract duration.
- the tests now lock the per-cycle meaning for monthly, quarterly and semi-annual schedules;
- the contract field is labelled `قيمة الدفعة التعاقدية` rather than an ambiguous total rent;
- the review step says `قيمة الدفعة التعاقدية لكل دورة`;
- cycle-boundary preview dates are no longer labelled invoice due dates.

## FOM-011 — Cycle-boundary preview dates were labelled as invoice due dates — HIGH — corrected

The frontend preview helper walks contract cycle boundaries from the contract start date. The authoritative invoice engine derives invoice issue/due dates from billing policy (`billing_day` and `grace_days`).

The old UI called the helper's cycle boundaries `تواريخ استحقاق الدفعات المقدرة`, which could cause an operator to approve a contract while believing the displayed dates were the actual server invoice due dates.

**Correction:** the UI now calls them `بدايات دورات السداد المقدرة` and explicitly states that the server determines actual invoice issue/due dates from the approved billing policy.

## FOM-012 — Payment-term templates are not the current scheduling authority — MEDIUM — wording corrected, behavioral wiring deferred

The Settings product stores payment-term templates with fields such as `installments` and `interval_type`, and a contract can retain a `payment_terms_id`. However, the current contract preview and verified billing path derive operational scheduling from contract fields such as `payment_cycle`, `billing_day` and `grace_days`; no evidence was found that selecting a template authoritatively rewrites or freezes those scheduling values.

That means presenting the template as if it itself drives the schedule is stronger than current evidence supports.

**Correction in the contract form:** the field is labelled `مرجع شرط السداد` and explains that the current operational schedule is controlled by the explicit contract billing fields.

**Deferred:** do not automatically wire template metadata into billing without an explicit domain contract, migration/replay proof and schedule-freeze tests. A future implementation may make templates true presets or true versioned authorities, but it must choose one and prove the behavior end to end.

## FOM-013 — Bank reconciliation candidate coverage may be narrower than the canonical cash/bank event universe — NEEDS PROOF

The current reconciliation service exposes candidate entity types:

- `payment`
- `receipt`
- `expense`
- `manual_adjustment`

Automatic positive suggestions query `payments`; automatic negative suggestions query `expenses`.

The canonical accounting model also contains cash/bank effects for owner settlement payouts, deposit refunds, broker-commission payments and compensating reversals. Repository evidence reviewed so far does not prove that every such movement is represented as one of the candidate entities above.

This is therefore **not yet classified as a confirmed accounting defect**, but it is a release-relevant reconciliation coverage question.

**Required proof before claiming complete bank reconciliation:** for each governed 1111/1120 movement class, demonstrate either:

1. a deterministic candidate/match path into bank reconciliation, or
2. an explicit exclusion with a documented alternative reconciliation control.

Do not broaden `matched_entity_type` ad hoc; changing reconciliation entity identity is a DB/domain change and needs its own governed mission.

## Updated correction rule

The audit uncovered a repeatable failure pattern:

> frontend labels and previews can remain historically plausible after the underlying accounting authority has been strengthened.

Future finance reviews must therefore compare four layers for every feature:

1. locked business meaning;
2. server/DB authoritative behavior;
3. frontend calculation/preview;
4. user-facing words and next-action workflow.

A green unit test at only one layer is insufficient if the layers disagree.
