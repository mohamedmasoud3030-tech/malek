# MALEK Canonical Pack — Document 1: Product Charter and Scope

> **Status:** CANONICAL  
> **Baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`

## Product definition

MALEK is an Arabic-first, multi-company property-operations system for real-estate offices. It manages the operational and financial lifecycle of properties, units, owners, tenants, contracts, collections, expenses, deposits, owner settlements, maintenance, banking and reporting.

The release is optimized for an operating property office, not for a generic ERP, investment platform, CRM suite, construction system, or marketplace. Adjacent legacy modules may remain for compatibility, but they do not silently expand release scope.

## Canonical product rules

| Rule ID | Canonical rule |
|---|---|
| `PRD-001` | MALEK is Arabic-first, RTL-capable and company-scoped; every operating company must be isolated from every other company. |
| `PRD-002` | The primary customer is a property office managing its own or third-party rental operations, owners, tenants, contracts and money flows. |
| `PRD-003` | The supported accounting/operating models are owner-agency/property-management and a separate master-lease/principal model; office-owned assets may use the same operational shell only where explicitly implemented. |
| `PRD-004` | Oman is the current jurisdictional/currency baseline; OMR is represented to three decimal places. Jurisdiction-specific legal/tax claims require explicit external approval. |
| `PRD-005` | Generic ERP, investment management, construction management, marketplace/e-commerce and unconstrained CRM expansion are outside the current release unless a later canonical decision adds them. |
| `PRD-006` | Core release surfaces are Properties/Units, People/Owners/Tenants, Contracts, Financials, Maintenance/Services, Reports/Accounting, Documents, Settings and governed administration. |
| `PRD-007` | Reports/Accounting is a distinct top-level workspace; financial operations may feed it but do not absorb it into the Financials hub. |
| `PRD-008` | AI Assistant is a separate route/capability and is not part of the accounting authority or financial source of truth. |
| `PRD-009` | “Production ready” requires evidence through the applicable chain `UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA/Runtime`; merged PRs or isolated component tests are insufficient. |
| `PRD-010` | Release proceeds through a controlled one-office pilot and reconciled operating/accounting cycle before broader production rollout. |

## Product boundaries

### In current product scope

- Company/authentication and active-company selection.
- Property, unit and land operational records where routes/domains exist.
- People, owners, tenants and service providers.
- Owner agreements and tenant contracts.
- Invoices, collections/payments, receipts, arrears, expenses and deposits.
- Owner settlements and bank reconciliation.
- Maintenance/service workflows and documents.
- General ledger foundations, accounting periods, reporting and reconciliation work.
- Permission requests/effective grants and audit/data-integrity surfaces.

### Not automatically release-critical

Legacy leads, communication, commissions, automation and lands remain real repository surfaces, but their existence does not make them independent product pillars or authorize new scope. They are retained where they support property operations or compatibility.

### Explicit non-goals for this closeout

- Rebuilding MALEK as a generic ERP.
- Historical financial backfill before the read-only analysis and approval gates.
- Claiming full IFRS, legal, tax, production or security certification from repository code alone.
- Adding a new feature merely to make documentation look complete.

## Jurisdiction and external review

The canonical accounting model is a product control model. Final Omani tax rates, contract wording, legal offset rights and document enforceability are external matters. Repository implementation must fail closed when a legally required configuration is absent; this pack does not manufacture legal approval.

## Evidence anchors

- Route/product reality: `rentrix-app/src/app/navigation/route-contract.ts`.
- Currency/accounting domain: `rentrix-app/src/features/accounting/accountingDomain.ts`.
- Locked business decisions: `governance/final-decision-register.json`.
- Governed stage credit: `governance/10-stage-master-plan.json`.
- Actual implementation status and gaps: Document 7.

## Release interpretation

This charter describes what the product is and what the release must prove. It does not grant stage completion. Repository surfaces that exist but are not yet governed/verified remain visible in Document 7 rather than being hidden or promoted to “done.”
