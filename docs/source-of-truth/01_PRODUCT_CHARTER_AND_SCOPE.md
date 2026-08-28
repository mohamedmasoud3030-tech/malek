# MALEK Canonical Pack — Document 1: Product Charter and Scope

> **Status:** CANONICAL  
> **Target Architecture Lock:** 2026-08-27  
> **Repository reality baseline for this lock:** `main@9e5c32e83082cac8227640cf260c51af01e54dc3`  
> **Governance note:** this target lock does not grant governed-stage credit or hosted/runtime acceptance.

## Product definition

MALEK is an Arabic-first property-operations and financial-management system for property offices. It is designed first for a small or medium office managing owner property, tenants, contracts, collections, maintenance and owner obligations, while preserving architecture that can scale without exposing enterprise complexity in daily work.

MALEK is not a generic ERP, broad CRM, marketplace, construction suite or hotel system. Its core value is that the office can answer three questions quickly and correctly:

1. What needs action now?
2. Whose money is this?
3. What is the current state of each property/unit/contract without reconstructing it from several places?

The product is **simple by default, powerful on demand**. Strong accounting, security and specialist capabilities remain underneath the product even when they are hidden from routine navigation.

## Customer, users and value

The primary buyer/operator is a property office. The routine staff experience exposes two simple personas: **Office Owner** and **Employee**. Underneath, MALEK keeps its effective-permission and six-role authorization engine for compatibility and specialist control.

A separate **Tenant Portal** is target scope as a constrained read-only surface. It is not part of the office navigation and must never expose another tenant's or another company's data. A general owner portal is not required by this target lock.

The product value is operational control with accounting traceability: what is due, what was collected, whose money it is, what the office earned, what the owner is owed, what expenses exist, what is vacant, and what needs follow-up.

## Canonical product rules

| Rule ID | Canonical rule |
|---|---|
| `PRD-001` | MALEK is Arabic-first, RTL-capable and company-scoped; every operating company must be isolated from every other company. |
| `PRD-002` | The primary customer is a property office managing its own or third-party rental operations, owners, tenants, contracts and money flows. |
| `PRD-003` | OWNER_AGENCY/property-management is the primary product model. MASTER_LEASE remains a separate specialist/principal model and is not part of routine target UX until deliberately promoted. |
| `PRD-004` | Oman is the current jurisdictional/currency baseline; OMR is represented to three decimal places. Jurisdiction-specific legal/tax claims require explicit external approval. |
| `PRD-005` | Generic ERP, investment management, construction management, marketplace/e-commerce, hotel operations and unconstrained CRM expansion are outside the current target unless a later canonical decision adds them. |
| `PRD-006` | The visible target IA has seven operational roots: Today, Portfolio, Leasing, Money, Services, Reports and Settings. Entity dossiers and specialist tools remain contextual/deep-link surfaces rather than competing top-level products. |
| `PRD-007` | Reports is a distinct top-level workspace. It explains operational and financial results in business language while specialist accounting remains available without becoming the daily UX. |
| `PRD-008` | AI Assistant is a global decision-support capability with a compact entry point and optional expanded workspace. It may read, explain, suggest, navigate and prepare drafts, but it is never accounting authority and cannot silently approve, post, pay, void or close sensitive actions. |
| `PRD-009` | “Production ready” requires evidence through the applicable chain `UI → Service/RPC → Database → RLS/Permissions → Audit → Tests → QA/Runtime`; merged PRs or isolated component tests are insufficient. |
| `PRD-010` | Release proceeds through a controlled one-office pilot and reconciled operating/accounting cycle before broader production rollout; target reconstruction is executed in gated priority groups, not by a parallel clean-room rewrite. |

## Target product surfaces

### Today
A current-office command surface, not a decorative KPI deck. Priority order:

1. office performance;
2. vacant units;
3. money to collect;
4. maintenance/problems;
5. contracts nearing expiry;
6. owner obligations;

Notifications represent events/information; Today represents items requiring attention or decision. They must not become duplicate feeds.

### Portfolio
Properties, units and owners are the main asset relationship surfaces. Property/unit dossiers hold operational context, documents, meters, maintenance and current relationship state. Heavy financial analysis belongs in Money/Reports rather than being duplicated in dossiers.

### Leasing
Contracts and tenants are the routine relationship surfaces. The generic `people` identity foundation remains canonical in the data model but is not a routine navigation destination. Long-term and short-stay rental use the same controlled contract concept; short stay is not a hotel module.

### Money
Collections, receipts, arrears, expenses, management consideration, owner obligations/settlements and light bank verification. The daily UX is business-language first; GL/journals and specialist accounting stay behind advanced/specialist access.

### Services
Maintenance, service providers and utilities/meters. Documents are contextual-first: contract documents live with the contract, maintenance evidence with maintenance, utility proof with the bill/period, owner documents with the owner. A global document index/search may exist, but Documents Vault is not a daily product pillar.

### Reports
Office performance, collections/arrears, property/unit performance, occupancy/vacancy, owner statements/settlements, tenant statements, maintenance/expenses, services and contracts/renewals. Advanced accounting remains available as specialist reporting.

### Settings
Company, employees/permissions, document/print preferences, approved configuration and governed administration. Audit, data integrity, system/support, automation and other specialist capabilities must not compete with daily operations.

## Target capability disposition

- **KEEP / strengthen:** auth/company isolation, RLS/RPC boundaries, GL/accounting engine, owner funds, contract/collection/expense/settlement lifecycles, PWA, print/export foundations, architecture guards and tests.
- **REBUILD UX:** Today, properties/units/owners/tenants/contracts, Money, maintenance/utilities, Reports, permissions UX and AI presentation.
- **HIDE from routine UX:** deposits, Automation, Data Integrity, Audit/System, advanced GL/journal surfaces and MASTER_LEASE specialist UI unless explicitly needed.
- **MERGE/contextualize:** generic People, Documents Vault, Communication, standalone receipts/legacy finance routes and other duplicate authorities.
- **LATER:** broad Leads/CRM expansion, visible branch-management enterprise UX, marketplace features and hotel-style short-stay operations.

## Tenant Portal target

Tenant Portal v1 is read-only and isolated. It may expose only the authenticated tenant's:

- identity/account summary;
- unit and active contract;
- due schedule;
- paid/remaining/overdue position;
- services/utilities relevant to that tenant;
- receipts/evidence;
- documents;
- maintenance records relevant to that tenant.

Electronic payment and core record editing are not part of v1.

## Explicit non-goals

- Rebuilding MALEK as a generic ERP.
- Creating a second frontend application merely to obtain visual cleanliness while duplicating the current tested core.
- Historical financial backfill before approved analysis/correction gates.
- Claiming full IFRS, legal, tax, production or security certification from repository code alone.
- Exposing internal accounting/security/technical vocabulary to routine users when a business-language presentation is sufficient.

## Jurisdiction and external review

The canonical accounting model is a product control model. Final Omani tax rates, contract wording, legal offset rights and document enforceability are external matters. Repository implementation must fail closed when a legally required configuration is absent; this pack does not manufacture legal approval.

## Evidence anchors

- `rentrix-app/src/app/navigation/route-contract.ts`
- `rentrix-app/src/features/auth/permissions.ts`
- `rentrix-app/src/features/finance/shell/financeShellModel.ts`
- `rentrix-app/src/features/active-register-inventory.ts`
- `DATABASE_RULES.md`
- Documents 2, 4, 5, 6 and 7 of this pack.

## Release interpretation

This charter locks the target product and the reconstruction direction. It does not mark every target surface implemented. Repository reality and remaining gaps continue to be reported separately in Document 7, and governed stage credit remains owned by the governance ledgers.
