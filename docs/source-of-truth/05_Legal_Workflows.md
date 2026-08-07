# 05 — Legal & Operational Workflows (canonical)

> Consolidates contract/legal logic and the day-to-day workflows for owners, tenants, properties, units, and the office. Signature/approval/termination rules are LOCKED (D10–D13); lifecycle implementation status is flagged per workflow.

## Sources merged here

| Source | What was taken |
|---|---|
| Constitution §§4–6, 9, 10 + ADR 0011 D10–D13 | Canonical lifecycles (LOCKED) |
| `docs/DOMAIN.md` | Current entity model & statuses |
| `docs/DATABASE_ARCHITECTURE.md` | Implemented lifecycle RPCs & protections |
| `docs/accounting/CONTRACT_RIGHTS_AND_ACCOUNTING_MATRIX_AR.md` | Legal-evidence question matrix |
| `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md` (S04/S05) | Target workflow tasks |
| `docs/NEXT.md` (daily office rhythm), `docs/SINGLE_OFFICE_LAUNCH.md` | Office/operator workflows |
| ADR 0001 (daily/open-ended, utilities, maintenance) | Decided-but-unimplemented workflows |
| `docs/handover/FORGOTTEN_PLANS_TODO_LIST.md` | Open workflow gaps |
| `docs/audits/2026-07-07-workflow-audit-ar.md` | Original office scenarios |

---

## 1. Entity & identity ground rules (implemented)

- **Tenant identity** resolves through `public.people` (`type='tenant'`) — contracts, receipt allocations, contract/tenant balances all reference `people(id)`. The legacy `public.tenants` table is deprecated/orphaned (migration `20260712020000`).
- **Owner↔Property ownership** is authoritative in **`property_owners`** (percentages, temporal `starts_on/ends_on`, ≤100% active, one primary owner per property); **management agreements** live in **`owner_agreements`** (type, commission, effective dates). `properties.owner_id/owner_name` are trigger-synced backward-compatibility projections only; `public.current_property_ownership` is the canonical read view.
- **Agreements cover contracts**: a tenant contract must be covered by a valid owner agreement for its period (enforced in contract RPCs); non-overlapping agreement periods per property are DB-enforced.
- **ID type reality:** several PK/FK columns are `text`, not `uuid` (contracts, expenses, deposits, settlements…). Never infer types from names or generated TS types — verify live (LESSONS_LEARNED rule).

## 2. Tenant contract lifecycle

### Current implementation (live)

`draft → active → (renewed | terminated | expired)`, soft-delete supported. All writes are atomic RPCs: `create_contract_atomic, update_contract_atomic, renew_contract_atomic, terminate_contract_atomic, soft_delete_contract_atomic` — with property/unit validation, agreement-coverage validation, overlap prevention, role checks, row locking. Termination/soft-delete cancels **future unpaid invoices** while preserving paid invoices and history.

Contract fields: tenant (people), unit, property, covering `agreement_id`, start/end dates, `rent_amount` = **the per-cycle contractual payment amount**, `payment_frequency` (`monthly | quarterly | semi-annual | annual`), status. Documents attach via `contract_documents`.

### Canonical target (LOCKED — S04 scope, not implemented)

```
DRAFT → PENDING_INTERNAL_APPROVAL → APPROVED → PENDING_SIGNATURE
      → SIGNED → ACTIVE → EXPIRING → EXPIRED   (+ TERMINATED / CANCELLED)
```

Activation gate (all required): valid unit in company · no occupancy overlap · covering agreement where needed · operating model + `collection_role` fixed · approvals complete (Maker–Checker, D11) · signature evidence complete (hash + signer + date) · **billing schedule frozen**.

Billing schedule semantics: `Preview at draft → Freeze at activation → Invoice at due date → Allocation at collection` (S04-T04/T05).

### Daily / open-ended contracts (decided, NOT implemented — FGR-008)

- Distinct contract type; default **checkout invoicing**; daily or weekly billing configurable per contract; proration = configured daily rate × counted days/nights.
- Open-ended contracts have no end date, renew per billing cadence, end only by manual termination or recorded notice/end date.
- Implementation must also cover overdue behavior and report segmentation [ADR 0001].

## 3. Invoice lifecycle (implemented)

Generation from active contracts (`generate_invoices_from_active_contracts`, company-scoped since 3A-1B); statuses `unpaid | partially_paid | paid | overdue | cancelled`, recalculated from paid amounts/tax/void state; payment posting only via `record_invoice_payment_atomic` / `post_receipt_atomic`; overpayment guards; invoice rows locked during settlement-sensitive flows; future unpaid invoices cancelled on contract termination/delete.

## 4. Payment → receipt → VOID flow (implemented + doctrine)

- One payment + one receipt share identity (`payments.id = payments.receipt_id` since `20260723100000`); allocations connect receipts to invoices and drive paid-state transitions.
- VOID (`void_receipt_atomic`): requires reason; preserves history; creates a **balanced reversal** (doctrine: clone original account IDs — implementation gap C-08); idempotent; invoice returns to unpaid/partial; statements update immediately.

## 5. Owner workflow (implemented + locked lifecycle)

1. **Create owner** → **create property with agreement** (`create_property_with_agreement`, atomic).
2. **Agreement management**: creation/update hardened against cross-company access (FA-004: company-scoped `SELECT … FOR UPDATE`, immutable `owner_id` on update, audit).
3. **Settlement lifecycle**: `create_owner_settlement_draft_atomic` (server-derived amounts; atomic reservation of collections/expenses via link tables) → `approve_owner_settlement_atomic` (re-derive; STM/stale rejection) → `pay_owner_settlement_atomic` (balanced 2000/1111 journals; row-count assertions) → `cancel_owner_settlement_atomic` (releases reservations; never for PAID).
4. **Statements & reporting**: owner statement (gross, fees, expenses, tax, opening/closing) with drill-down targets (FGR-003 partial).

**Master-lease agreements** follow the independent module (S06 kernel merged; see `04_Accounting`).

## 6. Property & unit workflows (implemented)

- **Guided creation**: 3-step wizard — property details → ownership & management → units & review; contract creation resolves covering agreement and shows estimated invoice schedule.
- **Property 360 workspace**: 8 URL-addressable tabs (overview, units, contracts & tenants, finance & collections, maintenance & utilities, ownership & operating agreements, documents, activity log).
- **Unit operational status**: server-derived (`resolve_unit_operational_status`), constraint `available/occupied/maintenance/reserved`; contract creation blocks maintenance/reserved units and prevents double booking.
- **Onboarding per D12**: staged baseline with per-type templates and waiver controls (target; S04/S05 scope).

## 7. Maintenance workflow (implemented + decision)

- Records per property/unit; resolution-with-cost via `resolve_maintenance_with_expense` (atomic expense + journal).
- **Decided, not implemented (FGR-010):** final charge responsibility (tenant/owner/office/split) is chosen **at resolution before posting**; expected responsibility may be captured at request creation; posting above thresholds needs approval; corrections need reason + audit; split allocations supported [ADR 0001 + FORGOTTEN #2].

## 8. Utilities workflow (foundational; decision awaiting implementation — FGR-009)

- Every utility bill needs an explicit charge target before posting: tenant invoice (consumption default), owner expense, office expense, or utility suspense until allocation.
- Required: manual meter entry, amount/percentage splits, threshold approval, independent due dates, reversals/corrections, statements, reports [ADR 0001 + FORGOTTEN #3].

## 9. Deposits workflow (implemented RPCs; decision D05)

`create_deposit_atomic / deduct_deposit_atomic / refund_deposit_atomic` — liability-based ledger (`2200`), idempotent (`request_id`), over-refund rejection, canonical contract/property derivation, cross-property payload rejection. Open after pilot: richer deposit statements & installment UX (FGR-012 note).

## 10. Bank reconciliation workflow (foundational + hardened import)

`bank_accounts → bank_statement_imports → bank_statement_lines → bank_reconciliation_matches`; manual match via `process_bank_reconciliation_match_atomic`; CSV paste import exists and was hardened to fail-closed atomic semantics in S02 (`import_bank_statement_batch_atomic`, company-scoped). Remaining per FGR-006: upload wizard (CSV/XLSX mapping/preview/duplicate detection), advanced suggestions, match statuses, final approval, seeded browser verification.

## 11. Office daily rhythm (pilot doctrine)

- **One-time setup:** company settings → owners → properties → units → tenants → contracts.
- **Daily:** dashboard → due invoices → collections/receipts → expenses → maintenance.
- **Day close:** daily reports → audit log → data-integrity check.
- **First week exclusions:** bank reconciliation, multi-company switching, advanced automation. First deposit & first settlement under ADMIN supervision.

## 12. Legal evidence still required (business action — OD-03)

The contract-rights matrix (2026-08-04) records that **no signed legal templates exist in evidence** (no property-management contract, no tenant lease, no master-lease contract). ADR 0011 closed the *product* decisions, but the following remain conditional on real contracts/review before any historical backfill or external legal claim:

1. Actual property-management agreement template. 2. Actual tenant lease template. 3. Actual master-lease contract (if used). 4. Explicit offset-rights and expense clauses. 5. Commission entitlement clauses per type. 6. Deposit usage & damages clauses. 7. Tax review when VAT is activated.

Until provided: no mass backfill of `principal_agent_role`, `collection_role`, `legal_offset_allowed`, `deposit_damage_beneficiary`; printing templates (`DocumentTemplates`) are presentation, **not** a source of legal rights.

## 13. Conflict register hooks

C-08 (void reversal), C-02 (fee basis), C-04 (COA numbering), C-05 (roles), C-07 (contract lifecycle states current vs canonical — implementation gap, not a fork), C-09 (Domain doc deposit claim vs implemented deposits) — details in `13_Conflict_Report.md`.
