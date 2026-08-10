# MALEK Canonical Pack — Document 3: Domain and Data Model

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`

## Domain principles

The database is multi-company and operational entities must remain company-scoped. Financial balances have explicit sources rather than being inferred from whichever screen is easiest to query. Historical financial records are append-only after posting or legal finalization.

## Canonical domain rules

| Rule ID | Canonical rule |
|---|---|
| `DOM-001` | Every company-owned operational or financial aggregate carries company scope; cross-company references and mutations are invalid. |
| `DOM-002` | Property is the primary real-estate aggregate; units belong to properties, while lands/other asset support remain distinct where implemented. |
| `DOM-003` | `people` is the identity/contact foundation; owner and tenant roles/profiles attach operational meaning without duplicating identity unnecessarily. |
| `DOM-004` | Owner agreements are versioned business contracts; material terms such as collection role, fee basis and offset rights are snapshotted/versioned rather than overwritten retroactively. |
| `DOM-005` | Tenant contracts have an explicit lifecycle and immutable signed-version evidence; amendments/renewals create new historical records or versions. |
| `DOM-006` | Invoices, payments, receipts and receipt allocations are distinct records; payments/posted collections drive cash reality while receipts remain audit/document evidence. |
| `DOM-007` | Owner settlements aggregate explicit reserved payment/expense links; one source item cannot belong to multiple active settlements. |
| `DOM-008` | Tenant deposits and deposit transactions form a liability subledger with explicit beneficiary/application/refund/reversal records. |
| `DOM-009` | Accounting uses company-scoped accounts, accounting periods, journal batches and journal lines; financial-statement balances derive from posted GL, not UI aggregates. |
| `DOM-010` | Audit records, documents and attachments preserve entity/company scope and lifecycle; destructive deletion is not a substitute for archive, void, reversal or versioning. |

## Core aggregates and relationships

### Company and authorization context

`company`/company membership is the isolation root. Active-company resolution is carried through Auth/JWT helpers and enforced again by database policy/RPC logic. A user identity may participate in more than one company, but a request must operate in one effective company context.

### Property estate

- `properties` — physical/managed property.
- `units` — rentable/operational units belonging to a property.
- `lands` — separate asset surface where present; not a unit alias.
- property ownership links connect owners to properties where supported.

### Party model

- `people` — reusable identity/contact record.
- `owners` — owner operational profile.
- `tenants` — tenant operational profile.
- `service_providers` — company-scoped supplier/service-provider profile.

Owner/tenant dossier screens are views over these records and related financial/contract data; they do not create an alternate financial source of truth.

### Agreement and contract model

- `owner_agreements` govern office–owner rights, fee basis, collection role and settlement rules.
- tenant `contracts` govern occupancy, schedule, obligations and signed evidence.
- amendments/renewals/versioned artifacts preserve prior legally/financially relevant values.

### Billing and collection model

- `invoices` represent tenant obligations/schedule outputs.
- `payments` represent actual collected payment events and are the operational source for collections.
- `receipts` represent receipt/audit documents.
- `receipt_allocations` connect receipt/payment value to obligations where applicable.
- `arrears` is derived from obligations versus satisfied amounts; it is not an independent cash ledger.

### Expense and maintenance model

- company operating expenses affect office P&L.
- owner expenses paid by the office create Due from Owner.
- tenant-recoverable charges require a single recoverable/receivable path.
- maintenance records link operational work to property/unit/party and resulting expense/claim records.

### Settlement model

Owner settlements are not the origin of owner liability. They collect/reconcile eligible owner funds, fees, taxes, owner receivables and payout. Reservation link tables/RPCs exist in the repository and prevent the same active source item from being reserved repeatedly at the database level where wired.

### Deposit model

Deposits remain liabilities until refunded or applied under an approved claim/invoice. Deposit transactions must identify source deposit, beneficiary/economic destination, evidence and reversal relationship where relevant.

### Banking model

Bank accounts/statements/imports and reconciliation records support operational matching. Imported rows must retain company/batch/source identity and must never mutate unrelated-company banking data.

### General ledger model

- `accounts` — company-scoped chart of accounts.
- `accounting_periods` — posting period authority.
- `journal_batches` — event-level balanced posting/reversal container.
- `journal_lines` — debit/credit lines owned by one batch.

A journal line does not exist independently of a balanced batch. Posted batches are immutable and corrections occur through reversal/adjustment.

### Audit and document model

Audit events identify company, actor and affected entity where available. Vault/attachments/contract documents are supporting evidence, not authoritative replacements for database state.

## Balance sources

| Balance / report | Canonical source |
|---|---|
| Financial statements / trial balance | Posted GL |
| Tenant operational balance | Invoice/collection subledger; reconciled to 1201 only when OFFICE_IS_CREDITOR |
| Owner payable | Owner-funds subledger reconciled to account 2000 |
| Due from Owner | Owner-receivable subledger reconciled to 1300 |
| Tenant deposits | Deposit subledger reconciled to 2200 |
| Broker commissions payable | Commission subledger reconciled to 2300 |
| Rent Roll / contract schedule | Contract/invoice operational subledger, not GL |
| Cash collection detail | Posted payment/collection events plus banking evidence |

## Mutability rules

- Draft operational records may be edited only within permitted lifecycle boundaries.
- Signed/approved legal versions are immutable; later material changes are amendments/versions.
- Posted financial history is immutable; correction is append-only.
- Soft delete/archive may be used only for non-posted/non-legally-final records where the domain allows it.

## Repository evidence anchors

- Generated database types: `rentrix-app/src/types/database.ts`.
- Core migrations and RLS/RPC history: `supabase/migrations/`.
- Settlement reservations: `20260804010000_fa003_owner_settlement_input_reservation_foundation.sql`, `20260804010100_fa003_owner_settlement_atomic_reservation_rpcs.sql`.
- GL domain types: `rentrix-app/src/features/accounting/accountingDomain.ts`.
- Service Providers addition at baseline: commit `75832b2f139f3b759325dcf17cf78101093671b4`.

Repository presence does not by itself prove the live schema equals migrations; live deployment verification is tracked separately in Document 7.
