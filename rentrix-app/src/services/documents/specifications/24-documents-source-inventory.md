# MALEK — 24 Business Documents Data Authority Inventory

> **Status:** Stage D0 baseline authority inventory.
> **Date:** 2026-08-28
> **Governing Spec:** `rentrix-app/src/services/documents/specifications/24-documents-contract-specification.md`

Every artifact is audited against the current repository state to establish whether canonical read/domain authorities exist or whether client-side derivation would be required (which is strictly forbidden).

---

## Complete 24 Business Artifacts Inventory Matrix

| # | Business Artifact | Technical Path | Readiness Classification | Real Source Authority (File / Service / Query / RPC) |
|---:|---|---|---|---|
| 1 | Lease Summary Sheet | `contract` | `READY_EXISTING_SOURCE` | `src/features/contracts/services/contractService.ts` (`getContractById`, `ContractDetail`) |
| 2 | Move-In / Move-Out Snagging | `unit_inspection` | `READY_AFTER_TYPED_ADAPTER` | `src/features/contracts/evidence/contract-evidence-service.ts` (`getContractEvidenceState`, `contract_inspections`) |
| 3 | Lease Renewal / Vacate Notice | `lease_notice` | `READY_AFTER_TYPED_ADAPTER` | `src/features/contracts/services/contractService.ts` (`ContractDetail`) + contract renewal/vacate workflow context |
| 4 | Rent Receipt Voucher | `receipt` | `READY_EXISTING_SOURCE` | `src/features/financials/receipts/receiptService.ts` (`getReceiptById`, `ReceiptRecord`) |
| 5 | Rent Due Invoice | `invoice` | `READY_EXISTING_SOURCE` | `src/features/financials/invoices/invoiceService.ts` (`Invoice`), `src/features/financials/invoices/invoice-actions.ts` |
| 6 | Security Deposit Voucher | `deposit_voucher` | `READY_AFTER_TYPED_ADAPTER` | `src/features/financials/deposits/deposit-service.ts` (`DepositRecord`, `listDeposits`, `listDepositTransactions`) |
| 7 | Aged Arrears Ledger | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/financials/reports/arrears-reports-service.ts` (`getArrearsSummaryReport`, `getAgedReceivablesReport`) |
| 8 | Debt Rescheduling Agreement | `debt_rescheduling` | `DATA_AUTHORITY_MISSING` | **DEFERRED**: No rescheduling table, domain model, or RPC exists in repository. |
| 9 | Commercial VAT Statement | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/financials/reports/financial-statements-service.ts` (`getVatReturnReport` / `rpt_vat_return`) |
| 10 | Tenant Final Clearance | `tenant_clearance` | `READY_AFTER_TYPED_ADAPTER` | `src/features/contracts/services/contractService.ts` + `src/features/financials/deposits/deposit-service.ts` |
| 11 | Owner Settlement Statement | `owner_settlement` | `READY_AFTER_TYPED_ADAPTER` | `src/features/owners/services/owner-settlements-service.ts` (`OwnerSettlementRecord`, `listOwnerSettlements`) |
| 12 | Annual Portfolio Report | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/reports/reports-insights.ts` (`buildExecutiveHealthInsights`), `src/features/reports/reports-page.helpers.ts` |
| 13 | Management Exit Clearance | `management_exit` | `READY_AFTER_TYPED_ADAPTER` | `src/features/owners/ownerAgreementService.ts` (`OwnerAgreement`), `src/features/properties/property-service.ts` |
| 14 | Vacancy Loss Audit | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/reports/reports-page.helpers.ts` (`buildOccupancyRows`), `src/features/reports/components/OccupancySection.tsx` |
| 15 | Unit Lifecycle Passport | `unit_passport` | `READY_AFTER_TYPED_ADAPTER` | `src/features/units/unit-service.ts` (`Unit`), `src/features/contracts/services/contractService.ts`, `src/features/maintenance/maintenance-service.ts` |
| 16 | Budget Variance Report | `generic_report` | `DATA_AUTHORITY_MISSING` | **DEFERRED**: No property/corporate budget domain model or RPC exists in repository. |
| 17 | Portfolio Benchmark Ranking | `generic_report` | `DATA_AUTHORITY_MISSING` | **DEFERRED**: No property benchmarking, scoring, or ranking model exists in repository. |
| 18 | Building Rent Roll | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/reports/reports-page.helpers.ts` (`buildRentRollRows`, `RentRollReportRow`) |
| 19 | Maintenance Work Order | `maintenance_work_order` | `READY_AFTER_TYPED_ADAPTER` | `src/features/maintenance/maintenance-service.ts` (`Maintenance`, `listMaintenance`) |
| 20 | Maintenance Completion Certificate | `maintenance_completion` | `READY_AFTER_TYPED_ADAPTER` | `src/features/maintenance/maintenance-service.ts` (`Maintenance`, `resolve_maintenance_with_expense_atomic`) |
| 21 | Annual Preventive Plan | `generic_report` | `DATA_AUTHORITY_MISSING` | **DEFERRED**: No preventive maintenance schedule authority exists in repository. |
| 22 | Utility / CAM Split Sheet | `generic_report` | `READY_EXISTING_SOURCE` | `src/features/utilities/utility-obligations.ts` (`UtilityObligation`, `UtilityObligationsSummary`) |
| 23 | Petty Cash Statement | `generic_report` | `DATA_AUTHORITY_MISSING` | **DEFERRED**: No petty cash ledger, account, or transactions authority exists in repository. |
| 24 | Eviction / Rental Dispute Legal Dossier | `legal_dossier` | `READY_AFTER_TYPED_ADAPTER` | `src/features/contracts/services/contractService.ts` + `src/features/financials/reports/arrears-reports-service.ts` + `src/services/documents/contextualDocumentsService.ts` |

---

## Summary of Readiness

- **Total Artifacts**: 24
- **Ready via existing technical document types (`contract`, `invoice`, `receipt`, `generic_report`)**: 9
- **Ready after typed dedicated document adapter**: 10
- **Data Authority Missing / Deferred by Product**: 5 (#8, #16, #17, #21, #23)
  - In accordance with Section 11 of the specification, missing authorities are explicitly deferred rather than fabricated with client-side calculations.
