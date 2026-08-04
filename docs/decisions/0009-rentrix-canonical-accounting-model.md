# 0009. Canonical accounting and contract rights model — Phase 1 (documentation only)

## Context

Rentrix/malik has an approved product-policy decision (`docs/decisions/0001-product-accounting-policies.md`) covering office fees, master lease cadence, daily/open-ended contracts, utility billing, maintenance allocation, tenant deposits, and the cash/accrual dual reporting model. That decision is a **product-owner policy instruction**, not a legal or accounting analysis grounded in actual signed contracts. Real GL infrastructure already exists and is actively evolving (`journal_entries`, company-scoped account resolution per ADR 0003/0005/0006, atomic settlement/expense/deposit RPCs), but no document in the repository had traced product policy through to (a) actual legal rights under real owner/tenant agreements, (b) a complete canonical event-to-journal-entry specification, or (c) numerically tested acceptance scenarios.

This ADR is the output of Phase 1 of a multi-phase accounting hardening effort. Its scope is strictly documentation and decision-gating. No migration, RPC, RLS, trigger, chart-of-accounts, journal entry, or frontend service was created or modified to produce it.

## Decision

We adopt the following as the canonical reference for all future accounting migrations, RPCs, reports, and tests, superseding informal assumptions but **not** superseding `docs/decisions/0001-product-accounting-policies.md` or ADR 0003/0004/0005/0006 — this ADR extends and cross-references them rather than replacing them.

1. **No legal contract evidence exists in the repository.** A full repository scan (`supabase/migrations/`, `rentrix-app/src/`, `docs/`) found zero PDF/DOCX contract files and no in-code legal text establishing rights and obligations between office, owner, and tenant. `DocumentTemplates.tsx` is a print-rendering engine for operational documents, not a source of legal rights. All findings in `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md` that depend on a real signed agreement are marked `PROVISIONAL` or `BLOCKED BY MISSING CONTRACT EVIDENCE`, not `APPROVED`.

2. **`property_management` is provisionally OWNER_IS_CREDITOR.** The collected-cash basis for office fees (0001) implies the office does not bear non-collection risk, which is consistent with an agent/collector role rather than a direct creditor. This is an inference from system behavior, not a proven legal classification. It must not be silently upgraded to `APPROVED` without a reviewed owner-management agreement.

3. **`master_lease` is the weakest-modeled business line in the system.** `agreementType = 'master_lease'` is a single enum value inside the same `owner_agreements` table as `property_management`; no dedicated schema exists for lease term, renewal options, escalation, or termination. The simplified operational treatment (fixed monthly obligation, independent of collection, per 0001) is explicitly **not** adopted as the complete accounting model — full lease classification (operating vs. finance, right-of-use asset, lease liability, discount rate) is `BLOCKED BY LEGAL REVIEW` and `BLOCKED BY MISSING DATA` pending a real master lease agreement and a qualified accountant's classification.

4. **C1–C11 are individually gated**, not collectively approved or blocked. Full detail is in `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md`. Summary: `C4` (proration) and `C10` (Net/Gross presentation) are `APPROVED` (both were already decided prior to this ADR, in ADR 0004 and product policy 0001 respectively, and are restated here for a single point of reference). `C1`, `C2`, `C3` are `APPROVED WITH CONTRACT CONDITION` — usable as a working default, reversible if a specific contract states otherwise. `C7` (currency/rounding) is `PROVISIONAL` because it surfaces a **direct numeric conflict** between this task's 3-decimal-place OMR requirement and the 0.01 rounding tolerance already committed in ADR 0003 §financial-security-ux — this conflict must be resolved explicitly by the product owner before implementation, not silently by picking one value. `C5` (master lease) and `C6` (accounting periods) are `BLOCKED` outright and must not be implemented until resolved.

5. **A full canonical event specification exists** (`docs/accounting/CANONICAL_ACCOUNTING_EVENT_SPEC_AR.md`) covering all 30 required financial events. 17 events have a workable specification (subject to the gates above); 13 are `BLOCKED` in full or in part, most heavily around broker commissions (the `commissions` table is explicitly documented in `docs/DOMAIN.md` as an inactive/placeholder tracking view, not a payout module) and master lease.

6. **Numerically tested scenarios exist** (`docs/accounting/ACCOUNTING_ACCEPTANCE_SCENARIOS_AR.md`) for all 11 required scenarios, using 3-decimal-place OMR arithmetic, including both OWNER_IS_CREDITOR and OFFICE_IS_CREDITOR readings of scenario 1 to make the structural (not numeric) difference between the two models explicit.

7. **No default value is assigned for legally sensitive fields on existing data.** `collection_role`, `principal_agent_role`, and `legal_offset_allowed` have no safe default for backfill; they require manual per-record review, not a bulk migration default. This is recorded explicitly in `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md` to prevent a future implementer from silently choosing a default under time pressure.

## Alternatives rejected

- **Defaulting `property_management` to OFFICE_IS_CREDITOR because invoices are technically issued by `company_settings`.** Rejected per this task's explicit instruction: technical invoice issuance is not proof of legal creditor status. The `OWNER_IS_CREDITOR` inference is grounded instead in the collected-cash commission basis, and is still only `PROVISIONAL`.
- **Treating `docs/decisions/0001-product-accounting-policies.md` as sufficient legal grounding on its own.** Rejected — it is an internal product-owner policy instruction, useful as the default operational basis, but it does not substitute for review of an actual signed owner-management or master-lease agreement. Every gate in this ADR that relies on 0001 alone (without contract evidence) is capped at `APPROVED WITH CONTRACT CONDITION`, never plain `APPROVED`, unless a prior ADR (0003, 0004, 0005, 0006) had already independently reached `APPROVED` status for that specific mechanism.
- **Assuming `Dr Rent Expense / Cr Owner Payable` as the complete master lease model.** Rejected explicitly per this task's starting assumptions and confirmed by the absence of any right-of-use/lease-liability schema in the repository.
- **Silently defaulting `collection_role` or `legal_offset_allowed` to a single value across all existing agreements.** Rejected — both carry legal consequences (revenue recognition timing, offset rights) that cannot be assumed correct for every existing owner relationship without review.

## Constraints

- This ADR and its companion documents are Documentation-only. No migration, rollback file, RPC, trigger, RLS policy, chart-of-accounts entry, journal entry, or frontend service was created or modified.
- No production data was read, written, or backfilled during this phase.
- Live schema verification for `journal_entries` posting-date/accounting-period columns, and for the actual definition of `pay_commission_atomic`, was **not possible** in this session (no `execute_sql` / `pg_get_functiondef` access was granted to this session's Supabase connector — only `list_tables`, `list_organizations`, `list_extensions`, `list_migrations`, and even `list_tables` returned a permission error). Findings that depend on this are marked `PROVISIONAL` and require a follow-up session with full read access before promotion to `APPROVED`.

## Exceptions

- `C4` and `C10` are restated from prior ADRs (0004, and product policy 0001 respectively) rather than newly decided here — they are included for completeness of a single canonical reference, not reopened.
- The financial golden path, permission matrix, and reconciliation/report scope already decided in ADR 0003 (`docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md`) are treated as binding constraints on this ADR's event specification, not superseded by it.

## Risks

- **C7 currency-precision conflict is the highest near-term risk.** If implementation begins on either the events spec or reports before this is resolved, historical rounding behavior could diverge silently between OMR-native (3dp) and the already-shipped 0.01 tolerance in ADR 0003, producing inconsistent report totals.
- **C5 (master lease) is the highest structural risk.** Any settlement volume run through the simplified monthly-obligation model without an explicit product-owner acknowledgment that full lease accounting is deferred risks producing financial statements that a future auditor could challenge if the office's actual legal position is closer to a principal (finance lease) than the current simplified treatment assumes.
- **Broker commissions (`commissions` table) risk being mistaken for a working payout module** by a future implementer skimming schema names rather than `docs/DOMAIN.md`'s explicit "inactive/placeholder" note; this ADR restates that warning to reduce that risk.

## Consequences on the system

- Future migrations touching `owner_agreements`, `tenant_deposits`/`deposit_transactions`, `journal_entries`, `expenses`, or `commissions` must implement the fields listed in `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md` rather than re-deriving them ad hoc.
- No `accounting_periods` concept exists yet; any close-of-period or backdated-adjustment feature requires designing that table first (C6), not as an afterthought bolted onto `journal_entries`.
- `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md` and `docs/FEATURE_GAP_REGISTER.md` (FGR-005, FGR-008 through FGR-013) remain the authoritative implementation-readiness trackers; this ADR adds legal/contractual grounding underneath them but does not close any FGR item.

## C1–C11 gates (summary — full detail in `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md`)

| Gate | Status |
|---|---|
| C1 — Invoice/tenant-receivable recognition | APPROVED WITH CONTRACT CONDITION |
| C2 — Office fee recognition timing by type | RATE: APPROVED · FIXED_MONTHLY: APPROVED WITH CONTRACT CONDITION · Broker commission: BLOCKED BY MISSING DATA · Setup/renewal fees: BLOCKED BY MISSING CONTRACT EVIDENCE |
| C3 — Owner expenses | APPROVED WITH CONTRACT CONDITION |
| C4 — FIXED_MONTHLY proration | APPROVED (restated from ADR 0004) |
| C5 — Master lease full accounting | BLOCKED BY LEGAL REVIEW + BLOCKED BY MISSING DATA |
| C6 — Accounting periods | BLOCKED BY MISSING DATA |
| C7 — Currency and rounding | PROVISIONAL (unresolved conflict with ADR 0003) |
| C8 — Due from Owner | PROVISIONAL / partially BLOCKED BY MISSING CONTRACT EVIDENCE (offset rights) |
| C9 — Deposit usage | Refunds/arrears offset: APPROVED · Damage beneficiary paths: BLOCKED BY MISSING DATA |
| C10 — Net/Gross presentation | APPROVED (restated from product policy 0001) |
| C11 — Agreement amendments | Principle (no rewriting history): APPROVED · Implementation detail: BLOCKED BY MISSING DATA |

## Implementation gates

The next accounting implementation phase may **not** begin until:

1. The product owner resolves the C7 currency-precision conflict explicitly (3dp OMR vs. 0.01 ADR-0003 tolerance).
2. A real owner-management agreement (or a representative sample) is reviewed against the questions in `CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md` section A, at minimum to promote `collection_role` from `PROVISIONAL` toward `APPROVED`.
3. A decision is made on whether master lease (C5) full accounting is in scope for the next phase at all, given its current `BLOCKED` status, or is explicitly deferred with an owner-acknowledged risk note (see Risks above).
4. C6 (accounting periods) is at minimum scoped as its own design task, even if not implemented immediately, since several other event specifications (invoice issuance, deposit refund, settlement approval) depend on knowing whether a period is open.

## Evidence

- `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md`
- `docs/accounting/ACCOUNTING_DECISION_GATES_AR.md`
- `docs/accounting/CANONICAL_ACCOUNTING_EVENT_SPEC_AR.md`
- `docs/accounting/ACCOUNTING_ACCEPTANCE_SCENARIOS_AR.md`
- `docs/accounting/ACCOUNTING_IMPLEMENTATION_IMPACT_MAP_AR.md`
- `docs/decisions/0001-product-accounting-policies.md`
- `docs/decisions/0003-company-scoped-account-resolution.md`, `0004-proration-and-billing-basis.md`, `0005-account-resolution-payment-receipt-void.md`, `0006-owner-settlement-account-resolution-and-request-binding.md`
- `docs/decisions/0003-financial-security-ux-reporting-and-reconciliation-scope.md`
- `docs/DOMAIN.md`, `docs/FEATURE_GAP_REGISTER.md`, `docs/PRODUCT_ACCOUNTING_DECISION_GATES.md`
- Migration filenames confirming existing GL infrastructure: `20260727091000_phase3a1a_canonical_accounts_expenses_deposits.sql`, `20260728090000_phase3a1b_canonical_accounts_invoice_payment_receipt_void.sql`, `20260729090000_phase3a1c_owner_settlement_account_resolution.sql`, `20260718100928_real_deposits_ledger.sql`, `20260801000002_pay_commission_atomic.sql`.
