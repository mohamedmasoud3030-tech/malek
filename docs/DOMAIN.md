# Domain

Core types live in `rentrix-app/src/domain/types.ts` (Supabase-independent) and `rentrix-app/src/types/database.ts` (generated from the live Supabase schema). When the two disagree, verify against the live schema — generated types can drift from what migrations actually produced (for example, some primary key columns are `text`, not `uuid`, even where a type might otherwise be assumed).

## Core entities and relationships

- **Owner** — a property owner. Has `isArchived` and `createdAt`. Owners relate to properties through **OwnerAgreement**.
- **OwnerAgreement** — links an `Owner` to a `Property` for a period (`startDate`/`endDate`), with `agreementType` (`property_management` | `master_lease`), `status` (`draft` | `active` | `terminated` | `expired`), and either a `commissionRate` (percentage) or a `fixedFee`. Implemented in `supabase/migrations/20260628100000_owner_agreements_core.sql` with a view (`vw_active_owner_agreements`, per migration) for the currently-active agreement per property/period. Non-overlapping periods per property are enforced at the database level.
- **Property** — has an optional `ownerId` (current owner reference), `name`, `address`.
- **Unit** — belongs to a `Property`; has `rentAmount` and `status` (`vacant` | `occupied` | `maintenance`).
- **Tenant** — a renter; has `phone`/`email`, `isArchived`.
- **LeaseContract** — links a `Tenant`, `Unit`, `Property`, and the covering `OwnerAgreement` (`agreementId`), with `startDate`/`endDate`, `status` (`draft` | `active` | `terminated` | `expired`), `rentAmount`, and `paymentFrequency` (`monthly` | `quarterly` | `semi-annual` | `annual`). All contract write operations are implemented as atomic operations (`create_contract_atomic`, `update_contract_atomic`, `renew_contract_atomic`, `terminate_contract_atomic`, and `soft_delete_contract_atomic`, per `supabase/migrations/20260712000000_contract_lifecycle_hardening.sql`) rather than separate client-side table writes (`insert`, `update`, `delete`). Contracts can have attached documents (`supabase/migrations/20260703010000_contract_documents.sql`, `rentrix-app/src/features/contracts/contractDocumentsService.ts`). Soft-deleting or terminating a contract safely cancels future unpaid invoices while preserving paid invoices and historical accounting state.
- **Invoice** — tied to a `LeaseContract`; has `amount`, `dueDate`, `status` (`unpaid` | `partially_paid` | `paid` | `overdue` | `cancelled`).
- **PaymentReceipt** — a payment against an `Invoice`; has `amount`, `paymentDate`, `paymentMethod` (`cash` | `bank_transfer` | `check`), optional `referenceNumber`. Recording a payment against an invoice is implemented as an atomic RPC (`record_invoice_payment_atomic`); see `docs/CURRENT_STATE.md` for its verification status.
- **Expense** — tied to a `Property` and optionally a `Unit`; has `amount`, `expenseDate`, `description`, and `responsibility` (`owner` | `office` | `shared`). Maintenance-driven expenses are created atomically alongside cost recording via `resolve_maintenance_with_expense` (`supabase/migrations/20260703000000_resolve_maintenance_with_expense.sql`).
- **OwnerSettlement** — a payout calculation for an `Owner` under an `OwnerAgreement`: `grossRevenue`, `expensesDeducted`, `feesDeducted`, `netPayout`, and `status` (`draft` | `approved` | `paid`).
- **AuditEvent** — a governance/audit log entry: `userId`, `role`, `action`, `entityType`, `entityId`, `timestamp`, `details`. Surfaced read-only via `/audit-log`.

## Other domain-adjacent tables/areas (present in `supabase/migrations/` and matching `src/features`)

- Cost centers (`add_cost_centers` migration, `features/settings/costCenterService.ts`)
- VAT support (`add_vat_support` migration)
- Payment terms (`add_payment_terms` migration, `features/settings/paymentTermsService.ts`)
- Cash flow reporting (`add_rpt_cash_flow` migration, `features/financials/reports/financialReportsService.ts`)
- Leads (`features/leads/`, backed by a `leads` table per `Database['public']['Tables']['leads']`)
- Lands (`features/lands/`)
- Commissions (`features/commissions/`) — confirmed from the current navigation copy, UI, service layer, tests, and captured `commissions` table shape as an operational tracking view of office/staff/broker commissions, not a full payout/accounting module. The app can create/edit/cancel tracking records and mark a record as paid operationally, but it does not create payment orders, expenses, ledger entries, owner settlements, or reconciliation records. The captured table includes an `expense_id` column, but the frontend service does not read or write it today; treat it as inactive/placeholder schema until a dedicated payout/accounting design, migration, and atomic backend flow are added.

## Authorization roles

`rentrix-app/src/features/auth/permissions.ts` defines three roles — `ADMIN`, `MANAGER`, `USER` — and a set of named permissions (e.g. `owners.hub.view`, `maintenance.view`, `settings.manage`, `audit.view`, `system.view`). Route guards and navigation items are gated by these permissions, not by role name directly.

## Areas not yet found in the domain model

Based on migrations and `src/features` at the time of this check, there is no dedicated modeling for: security deposits, deferred revenue, or multi-currency amounts. Bank reconciliation has an initial foundation for bank accounts, statement lines, manual matches, CSV paste import, and basic suggested matches by date/amount; bank-file upload/format mapping, duplicate detection, and advanced reconciliation rules are not yet implemented. Treat any assumption about the remaining areas as unconfirmed until verified against a current schema check.

## Payment and receipt reporting rule

The current financial source of truth for collections is `payments`. Receipts are the user-facing history/projection for recorded payments. A VOID payment/receipt remains useful for audit/history display, but VOID amounts are excluded from daily collection, cash-flow revenue, payment totals, and collection summaries.
