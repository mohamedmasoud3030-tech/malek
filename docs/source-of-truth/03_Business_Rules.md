# 03 — Business Rules (canonical)

> **Binding sources (LOCKED, change-controlled):**
> - `docs/business/CANONICAL_BUSINESS_AND_CONTRACT_RULES_AR.md` (constitution v2.0.0, SHA-256 `382a0b8c…74a79`)
> - `docs/decisions/0011-final-business-accounting-and-operating-policies.md` (D01–D18) — machine twin `governance/final-decision-register.json`
> - Change requires: owner approval + new/superseding ADR + schema-version bump + changelog + SHA update + green Canonical Business Rules Guard.
>
> This document consolidates every business rule found in the documentation. It restates them in English for a single reading path; **in any wording dispute the Arabic locked sources win.** Rules marked **[LOCKED-Dxx]** trace to ADR 0011; **[ADR-0001]** to the product accounting policies; **[SCOPE]** to ADR 0003-financial scope; **[OPS]** to operating records (launch/pilot/docs).

## Sources merged here

| Source | Status of its content |
|---|---|
| Constitution v2.0.0 + `final-decision-register.json` (D01–D18) | LOCKED, current |
| ADR 0001 (office fees, master lease, daily contracts, utilities, maintenance, deposits, dual reporting) | Absorbed into constitution; still valid where not refined by D01–D18 |
| ADR 0003-financial (roles, golden path, reports, RTL, bank-rec scope) | Valid; role expansion unimplemented (C-05) |
| ADR 0004 (FULL_MONTH basis) | **Superseded in substance by D02 — see C-02** |
| `docs/PRODUCT.md` receipts/collections decision | Current |
| `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md`, `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md` | Gate/BLOCKED statuses voided by ADR 0011 supersession; legal-evidence action list preserved (OD-03) |
| `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md` | FINAL mirror of D01–D18 (C1–C11); folded here |

---

## 1. Invoices & tenant receivables — [LOCKED-D01]

- `OWNER_IS_CREDITOR`: the invoice + receivable live in the **tenant subledger**; full rent is never an office asset/revenue in GL. A collection into the office account creates `Owner Funds Payable`.
- `OFFICE_IS_CREDITOR`: invoicing posts `Dr Tenant Receivable / Cr Owner Funds Payable or Rental Revenue` (per operating model); collection posts `Dr Cash/Bank / Cr Tenant Receivable`.
- `collection_role` is stored explicitly in the agreement and snapshotted into the contract.

## 2. Office fees & revenue recognition — [LOCKED-D02, D03]

- **RATE (%):** recognized **on actual collection** (not on invoicing). [ADR-0001 identical]
- **FIXED_MONTHLY:** accrues **daily** over the service period. **There is no FULL_MONTH default after ADR 0011.** (Conflict C-02 vs ADR 0004 — formal supersession note pending; owner confirmation requested, see `12_Open_Decisions.md` OD-01.)
- Any amount collected **before** its recognition event is **deferred revenue / liability**, never earned revenue.
- **Brokerage fee:** recognized when a duly approved and **signed** contract activates. Pre-activation collections are deferred revenue; cancelling pre-activation reverses or leaves a refundable liability per contract.
- **Renewal fee:** on activation of the renewal version (not at draft).
- **Setup/preparation fee:** on accepted handover record; milestone-split services recognize per accepted milestone.
- **Staff/external broker commission:** payable expense + liability after the qualifying event completes and is approved; if conditional on collection, never before collection.
- Fees never apply to deposits, refunds, or utility pass-through amounts unless a contract rule explicitly enables it [ADR-0001].
- Fees appear in owner statements, income reports, settlement reports [ADR-0001].
- Contract-specific rules may override defaults per owner/property/contract [ADR-0001].
- Voids/refunds/reversals automatically reverse the related fee at the linked rate/allocation with an audit trail [ADR-0001].

## 3. Master lease — [LOCKED-D07] + [ADR-0001]

- Independent module from Owner Settlements — the office is principal toward the sub-tenant; owner-obligation persists **even when vacant**.
- Creates a fixed owner obligation independent of tenant collection unless the contract says otherwise; default cadence **monthly**, configurable [ADR-0001].
- Master-lease profit = tenant collections − owner obligation − related expenses; settlements require approval before payment [ADR-0001].
- Accounting: ROU asset + lease liability at commencement; discount rate = implicit rate else IBR snapshot; effective-interest subsequent measurement; straight-line depreciation on shorter of term/useful life; defined modification rules; short-term (≤12-month) election at company/asset-class level, void if a purchase option exists.
- Never post master-lease obligations to owner-payables accounts; never use Owner Settlements as a substitute for lease-liability accounting.

## 4. Owner expenses & offsetting — [LOCKED-D04]

- Office paying on behalf of owner: `Dr Due from Owner / Cr Cash/Bank` — never an office P&L expense.
- Offsetting against owner payouts only when the agreement grants an explicit right, in this fixed order: **(1) due owner expenses → (2) office fees + related tax → (3) agreed reserve top-up → (4) net owner payout.**
- If owner payables are insufficient, the remainder stays `Due from Owner` — an Owner Payable balance never goes negative.

## 5. Tenant deposits — [LOCKED-D05] + [ADR-0001]

- Receipt creates a **liability** to the tenant, not revenue.
- Beneficiary and custodian are explicit in contract/agreement.
- Application requires, together: approved claim/invoice, evidence document, allocation to specific documents, atomic deposit transaction.
- Applying to arrears settles **real invoices** atomically; damage compensation goes to the economic beneficiary named in the contract.
- Partial and full refunds are both approved paths. Reversal is a compensating transaction — the original transaction is never deleted.
- Each contract has an independent deposit ledger; tenant view aggregates [ADR-0001]. Offsets to rent/maintenance/penalties/utilities need an approved offset workflow; forfeiture needs reason + audit; installments supported; interest disabled by default unless law/contract requires [ADR-0001].

## 6. Accounting periods — [LOCKED-D06]

- Monthly periods: `OPEN → SOFT_CLOSED → HARD_CLOSED`.
- `SOFT_CLOSED` blocks ordinary postings; only approved adjustments. Reopening needs period-close permission or Admin + audit log + explicit reason.
- `HARD_CLOSED` is irreversible.
- Late events post into the **first eligible open period**, preserving the original `effective_date`, with real `posted_at` and `late_posting=true`. Posting into a hard-closed period is forbidden.

## 7. Late fees — [LOCKED-D09]

- **Disabled by default**; require an explicit contract clause, a grace period, and a cap.
- Types: one-time fixed / one-time % / recurring fixed / recurring %. **No compounding** (never a penalty on a penalty).
- Server-side calculation only; a penalty is its own charge with its own account and tax code.
- Waiver/reduction needs permission + reason + audit log.

## 8. Early termination — [LOCKED-D10]

- Starts with a request, ends with approval + a termination record; requires `effective_termination_date`.
- Future schedule rows are **cancelled, never deleted**; amounts due/invoiced up to the termination date are preserved.
- Default termination penalty: **none** — only an explicit contract clause (fixed amount / number of payments / % of remaining contract value) can create one.
- Re-listing cost is a separate charge. Final inspection precedes deposit settlement. No future revenue recognized merely because the original term was longer.

## 9. Approvals & signatures — [LOCKED-D11]

- **Maker–Checker is default**: the creator of a contract is not its final approver for material contracts.
- Sole-admin exception only with an explicit company setting, shown with a clear audit flag.
- New contracts, renewals, subleases, and material amendments need internal approval; amounts above the company threshold need Admin.
- Pre-activation requires the tenant's signature and the authorized office representative's; material amendments need affected parties' signatures. Accepted evidence: uploaded signed copy or external e-signature evidence; keep document hash, signer identity, date, source.
- **An unsigned contract never activates.**

## 10. Property onboarding — [LOCKED-D12]

- Baseline path: (1) property data → (2) owner & agreement → (3) documents → (4) units → (5) inspection → (6) risk assessment → (7) handover & signatures.
- Templates per property type (residential/commercial/villa/building). `OFFICE_OWNED` waives only the owner-agreement step; land may waive units/occupancy checks.
- Step waiver: Admin-only + reason + evidence + expiry (if temporary) + audit. Property identity, company, ownership/operating right, and critical safety items are never waivable.

## 11. Agreement/contract amendments — [LOCKED-D13]

- No silent retroactive edits. Material change creates a new **Amendment/Version** with `effective_from/effective_to`; the active contract keeps the snapshot of the agreement it was activated under.
- Legal retroactive corrections happen via catch-up or reversal entries — history is never rewritten.

## 12. Owner settlements — [LOCKED-D14] + implemented invariants

- Settlement items (collections + expenses) are **reserved atomically at draft**; the same collection/expense can never enter two active settlements (DB-enforced partial-unique links, FA-003).
- Reservation releases on cancel and becomes permanent after payment.
- Amounts are **server-derived** (P1) and **re-derived before approval and before payment**; stale or changed inputs fail loudly.
- A refund before payment recalculates the settlement; a refund after owner payment creates `Due from Owner`.
- A settlement aggregates existing obligations; it never creates the rent or the commission.
- Settlement requires approval before payment [ADR-0001 master-lease + lifecycle].

## 13. Voids, credit notes & refunds — [LOCKED-D15] + collections doctrine

- Posted invoices/receipts/journals/paid settlements are **never deleted** — void / credit note / reversal only.
- Cash refunds require a reversing entry + a Payment-Out transaction.
- Receipt/payment identity is unique and idempotent (`request_id` + canonical fingerprint; reuse for a different target/payload = hard error).
- **Collections source of truth** [PRODUCT/README/DOMAIN]: payment-backed. Receipts UI reads `public.payments`; financial totals use posted, non-deleted, non-VOID rows. VOID rows remain visible as history but are excluded from collection, cash-flow, and payment-total reports (FGR-001 closed).

## 14. Bank CSV import — [LOCKED-D16] + [SCOPE] launch scope

- Preview before writing is mandatory. Any ambiguous mapping or invalid row blocks **the whole batch** — no silent partial success. After correction, the user imports a fresh clean file/batch.
- Server-side file/row limits; OMR 3dp; a row with both debit and credit non-zero is rejected (row + batch).
- Deterministic fingerprint; re-importing the same file returns the same batch. Accepted/Rejected/Duplicate counts are server-authored.
- Launch import formats: CSV + XLSX; OFX later if needed; MT940 only if a specific bank requires it [SCOPE]. Per-bank mappings. Duplicate detection on account/date/amount/reference/balance/batch hash. Matching: manual + suggested first; auto-match only high-confidence, initially behaving as suggestion, never auto-posting. Unmatch needs reason + audit. Reconciliation closes with an approval; it adds a bank-verified status and may not change financial totals without an explicit adjusting transaction.

## 15. Historical correction — [LOCKED-D17]

- Read-only analysis first (S08), then approved append-only correction batches (S09); every batch carries company/period/owner/property/agreement/source-event.
- Never UPDATE/DELETE historical entries; financial rollback = reversing entries; before/after evidence + approval required.

## 16. Execution governance — [LOCKED-D18] + plan rules

- 10 stages, one stage per PR; every branch from latest `main` after SHA proof.
- No reuse/cherry-pick from the superseded `business/domain-contract-foundation` branch.
- Agent marks only the Agent Checklist; Reviewer Ledger is reviewer-only; no stage is COMPLETE without: all agent tasks + evidence + gates + reviewer marks + merge + green main.
- If code conflicts with binding decisions, **fix the code** — never bend the decision. Gaps found become Findings; no silent scope expansion.

## 17. Roles & permissions

- **Implemented today:** `ADMIN`, `MANAGER`, `USER` (`features/auth/permissions.ts`), permission-gated routes/nav (not role-name checks).
- **Decided business scope [SCOPE]:** six roles — Admin (all), Manager (invoices/payments/operational exports/tenant-contract ops; **not** void, settlement approve/pay, or final bank-rec approval unless granted), Accountant (invoices/payments/void-with-reason/settlements/reports/reconciliation/adjustments per assigned permissions), Viewer (read-only), Owner & Tenant (future read-only portals). Export and bank match/unmatch/approval are separate permissions. Every financial action audited; denied actions show "You do not have permission to perform this action."; super admin is break-glass audited only. → Implementation gap tracked as conflict **C-05** / OD-04.
- Pilot posture [OPS]: first week is ADMIN-only, then MANAGER/USER after day-1 audit review.

## 18. Financial golden path & reporting requirements [SCOPE]

- Approved golden path: `invoice → payment → receipt → void receipt/payment → report proof → statement proof → audit proof`.
- Payment methods: cash + bank transfer fully supported; online payment may be simulated depending on integrations.
- Voiding: requires reason; never deletes history; restores correct net totals; returns invoice to unpaid/partial; updates tenant/owner statements immediately; writes audit evidence.
- Launch-required reports: daily collections, overdue invoices, aged receivables, income statement, balance sheet, trial balance, rent roll, owner statement, tenant statement, settlement report, bank-reconciliation report (if in scope). CSV export on every report; PDF/print required for owner statement, tenant statement, daily collections, income statement, settlement report. Statement contents (owner: rent collected, office fees, maintenance deductions, utility/owner expenses, settlement payments, opening/closing; tenant: invoices, payments, deposits, utilities, maintenance charges, credits/refunds/voids, running balance). Rounding line-level; tolerance 0.01 per report total; include-voided display option.
- Language: Arabic RTL primary; English must not break but may be completed later [SCOPE].

## 19. Dual reporting model — [ADR-0001]

- Collection reports = **cash basis**; accounting financial reports = **accrual/deferred basis**. Annual/prepaid rent defers in accounting reports and recognizes over the contract period; tenant statements show prepayments as credits consumed by invoices/period; voids/refunds reverse deferred revenue automatically; a deferred-revenue schedule/report is required (implementation gap — FGR-013, PL-001).

## 20. Rules that were explicitly REJECTED (do not re-propose)

- Invoiced-basis default for fees/settlements (recognizes commission before cash) — rejected in 0001.
- VAT on by default — rejected; environment-specific configuration only.
- Master lease as an ordinary % management agreement — rejected.
- Deposits as rent or auto-offset — rejected.
- Frontend permission hiding as sufficient authorization — backend RLS/RPC/grant proof required.
- Mobile acceptance on desktop emulation only — rejected.
- Auto-posting bank matches by default — rejected.
- Merging `/financials` and `/reports` into one hub — rejected (ADR 0008).
- Backfill of legal-sensitive fields (`principal_agent_role`, `collection_role`, `legal_offset_allowed`, `deposit_damage_beneficiary`) without contract evidence — prohibited (contract-rights matrix + constitution §15).
- Big-bang redesign; raw Tailwind palette classes in product surfaces; replacing MALEK blue or Cairo font; indigo/violet gradients & Plus Jakarta Sans — rejected (ADR 0012/0013/0014).
- Rewriting migration-ledger history / deleting ledger rows / editing committed migrations — rejected (Engineering Governance + Migration/Rollback policy).
- Mass deletion of the ~250 stale git branches without an owner decision — explicitly out of scope of any technical session (NEXT.md standing items).
