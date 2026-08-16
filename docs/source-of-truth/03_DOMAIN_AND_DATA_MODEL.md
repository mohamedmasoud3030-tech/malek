# MALEK Canonical Pack — Document 3: Domain and Data Model

> **Status:** CANONICAL  
> **Baseline:** `main@da9a98a38e61e9547df1e328ad91084e79b78410` (sequential financial hardening and WP-07 closeout)

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

### Relationship and ownership matrix

| Parent / root | Child / link | Cardinality and ownership invariant | Lifecycle authority | Baseline evidence / limitation |
|---|---|---|---|---|
| `companies` | operational/financial rows | one company owns many rows; each owned row belongs to exactly one company once migration constraints are active | RLS + FK/constraint + sensitive RPC revalidation | company columns/hardening migrations/tests exist; deployed drift remains `GAP-003` |
| `companies` + auth user | `company_members` | many-to-many membership; only active membership in an active company may become JWT company claim | Auth Hook + membership RLS | hook function exists in migration; `supabase/config.toml` does not prove hosted hook enablement |
| `people` | `owners` / tenant meaning | one person may acquire party roles without duplicating contact identity | party/profile services and RLS | legacy schema also exposes role-specific shapes; deduplication is an invariant, not proof of a finished migration |
| `properties` | `units` | one property has zero-to-many units; a unit belongs to one property/company | property/unit constraints and atomic contract writes | schema/routes/tests exist |
| `properties` ↔ `owners` | `property_owners` | many-to-many; share/primary-owner rules must be explicit and company-consistent | ownership view/constraints | `authoritative_property_ownership` work exists |
| `owner_agreements` | `owner_agreement_versions` | one identity has ordered versions; at most one unsuperseded current version | `create_owner_agreement_version_atomic` | implemented in migrations/pgTAP; generated client types cover the table, while the complete management UI remains GAP-004 |
| `owner_agreement_versions` | `contracts` | many contracts may snapshot one applicable agreement version; snapshot is immutable after activation | contract approval/activation RPCs | columns/constraints/pgTAP exist; full React service wiring is open |
| `contracts` | `invoices` | one contract creates many scheduled obligations; posted/void/cancel behavior is lifecycle-controlled | invoice generation/credit/reversal RPCs | legacy and canonical paths coexist |
| `payments` ↔ `receipts` | shared identity + `receipt_allocations` | payment is cash event; receipt is evidence; allocations distribute amount to obligations | payment/receipt RPCs and identity triggers | shared identity and reversal work exists; do not collapse the records conceptually |
| `owner_settlements` | payment/expense links | one settlement has many reserved sources; a source has at most one active reservation | create/approve/pay/cancel RPCs + partial unique indexes | implemented and concurrency-tested |
| `tenant_deposits` | `deposit_transactions` | one deposit has append-oriented held/deduction/refund events | deposit RPCs/application posting | *Engineering Complete:* OMR 3dp, RPC-owned, append-only/compensating, `GAP-009` fully closed |
| `journal_batches` | `journal_lines` | one batch has two-or-more lines; each line belongs to one same-company batch/account; posted batch must balance | GL engine, deferred balance/lifecycle triggers | canonical Stage-3 model implemented/tested |
| `bank_*` | import/match records | one import batch owns rows; rows retain source identity and company | preview/finalize/match RPCs | repository fail-closed contracts exist; hosted proof open |
| entity/company | audit/documents | records retain actor/company/entity and immutable or archived history | audit triggers/RPCs; private Storage policies | repository controls exist; deployed Storage/legal proof open |

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

- `invoices` represent tenant obligations/schedule outputs. RC1 owner-agency invoices carry immutable server-derived agreement-version, operating-model, collection-role, accounting-classification, source-batch and tax-profile/snapshot lineage once posted.
- `payments` represent actual collected payment events and are the operational source for collections; RC1 supports controlled `cash` → 1111 and `bank_transfer` → 1120 only until another clearing-account policy is approved.
- `receipts` represent receipt/audit documents.
- `receipt_allocations` connect receipt/payment value to obligations where applicable; `invoice_payment_tax_allocations` retains the original invoice tax component for controlled collection allocation.
- `invoice_credits` are append-only credit/reversal records with immutable net/tax/source-economic components; callers do not choose GL accounts.
- `owner_funds_event_cutovers` records an S08-approved immutable opening balance/fingerprint for a company with historical 2000 sources; `owner_funds_events` then forms the append-only post-cutover operational control. Legacy `owner_balances` is not rewritten to manufacture historical lineage.
- `company_fee_tax_treatments` and `management_fee_tax_snapshots` keep RATE/FIXED service-tax policy separate from rent-tax policy and fail closed when the applicable fee treatment is absent.
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

*Engineering Complete:* Under the current Release Candidate, the deposit subledger has been fully hardened to OMR 3dp with direct writes revoked, and unified behind atomic server-authoritative RPCs (`GAP-009` fully closed).

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

## Lifecycle state authority

| Aggregate | Canonical state progression | Data rule |
|---|---|---|
| Owner agreement version | current → superseded | a new version closes/supersedes the prior one; no retroactive overwrite |
| Tenant contract | DRAFT → REVIEW/PENDING approval → APPROVED → SIGNED/ACTIVE; then renewal/termination | maker/checker and signatures precede activation; the signed snapshot is retained |
| Invoice/payment/receipt | draft/posted operational state → paid/partial as applicable → void/credit/refund through explicit event | deletion cannot erase posted economic effect |
| Owner settlement | DRAFT → APPROVED → PAID, or cancellable before paid | inputs rederived at approval/payment; reservations survive paid state |
| Deposit | held/partially deducted → applied/refunded/closed through transactions | remaining value never becomes negative; corrections compensate |
| Accounting period | OPEN → SOFT_CLOSED → HARD_CLOSED | hard close cannot reopen under the canonical decision |
| Journal batch | DRAFT → POSTED → REVERSED | posted identity/lines are immutable; reversal references the original |

Names above describe canonical meaning; legacy lowercase/alternate database values are mapped only where a cited migration or service proves compatibility.

## Repository evidence anchors

- Generated database types: `rentrix-app/src/types/database.ts`. WP-DB0 generates this file from a clean replay of the full migration chain (tables, views, enums, relationships and every RPC overload). It is the repository contract; live parity still requires the hosted migration-ledger and schema probes.
- Core migrations and RLS/RPC history: `supabase/migrations/`.
- Settlement reservations: `20260804010000_fa003_owner_settlement_input_reservation_foundation.sql`, `20260804010100_fa003_owner_settlement_atomic_reservation_rpcs.sql`.
- GL domain types: `rentrix-app/src/features/accounting/accountingDomain.ts`.
- Service Providers addition: migrations `20260810170000_service_providers_production_grade.sql` and `20260810171000_service_provider_atomic_writes.sql`, merged in the baseline line.

Repository presence does not by itself prove the live schema equals migrations; live deployment verification is tracked separately in Document 7.
