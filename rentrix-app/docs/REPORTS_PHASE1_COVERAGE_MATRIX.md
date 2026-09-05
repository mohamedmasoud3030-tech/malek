# MALEK Reports — Canonical Product Coverage Matrix

**Status:** Supporting authority and coverage artifact. It does not replace the canonical finance, security, and UX source-of-truth documents.

## Purpose

This matrix inventories the live report and statement products, their business
question, and read/document authority. It is deliberately a product-route map,
not a second navigation registry. `/reports` is the analytical and operational
report catalog; it exposes report products only. Owner and tenant statements
use the same canonical direct route (`/reports/$reportId`) and body dispatcher,
but are opened from the applicable owner, tenant/person, or contract context.
An optional `view` selects a supported product target. Historical `workspace`,
`section`, `report`, and legacy `view` query URLs are translated at the route
boundary before a renderer mounts.

## Canonical products

| Product route                             | Experience | Product targets                                                                                    | Business question                                                                                  | Primary authority boundary                                                                                 | Document/output treatment                                                                                                                                                    |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/reports/owner-comprehensive-statement`  | Entity account statement — opened from the owner dossier | `statement` | What is the owner's authoritative movement, deductions, settlement position, and payable context? | `rpt_owner_statement`, settlement lifecycle authorities, and professional owner report payload | Owner professional document; server/RPC totals are normalized and formatted only. The header exposes owner/scope/period and returns to the owner. |
| `/reports/tenant-statement`               | Entity account statement — opened from a tenant/person contract or contract detail | `statement` | What are the tenant contract's obligations, collections, reversals, and running balance? | `rpt_tenant_statement` operational-subledger authority | Tenant statement document; no client-side balance reconstruction. The header exposes tenant, property/unit, contract term, and returns to the contract. |
| `/reports/collections-arrears-cheques`    | Analytical/operational report — catalog product | `period`, `arrears`, `follow-up`, `movement` | What was billed, collected, outstanding or overdue, and what follow-up is needed? | Canonical financial-reporting summaries, arrears reports, receipt/payment read models | Rent-roll and aged-arrears documents remain on the existing document platform. Period and as-of semantics stay distinct. |
| `/reports/portfolio-property-performance` | Analytical/operational report — catalog product | `property`, `office`, `occupancy`, `expiring`, `operations`, `maintenance`, `expenses`, `services` | How is the portfolio or selected property performing across leasing and operations? | Property-performance and vacancy read models plus the owning maintenance, expense, and service authorities | Property and portfolio documents reuse the existing professional/document infrastructure. Independent operational sources are never silently combined into owner deductions. |
| `/reports/financial-settlement-pack`      | Analytical/operational report — catalog product | `financial-movement`, `statements`, `ledger`, `revenue` | What do the authoritative financial and GL read models show for the selected period or as-of date? | Posted GL/accounting-report authorities and retained financial read model | Accounting outputs retain their existing accounting/document authority and controls. |

## Canonical renderer boundaries

- `reports-page.tsx` renders the analytical/operational catalog only; it gives
  contextual guidance for account statements rather than a competing statement
  catalog or global Statements destination.
- `premium/report-product-page.tsx` remains the shared direct product route.
  For reports it renders report chrome and a catalog return. For entity account
  statements it renders distinct statement chrome (holder/scope/action/return),
  while retaining the exact same product, authority, documents, and body
  dispatcher.
- `components/report-view-panel.tsx` is the canonical report-body dispatcher.
  It receives the product's resolved section/view and has no primary
  navigation, catalog, compatibility, or URL ownership.
- `use-reports-workspace.ts` is the retained lazy read model. It may select
  authoritative queries; it is not a second reports UI or financial authority.
- `report-products.ts` is the sole product/target metadata source.
- `report-route.ts` is the sole route/deep-link normalization seam.

## Financial and security invariants

- Owner and tenant statement rows, totals, balances, and running values remain
  RPC/server authoritative. The client does not rebuild them.
- GL statements, trial balance, income statement, balance sheet, and general
  ledger remain derived from the posted accounting authority and resolved
  accounting periods.
- OMR authoritative precision remains three decimals; database/server posting
  logic owns final rounding.
- Period, as-of, lifecycle, outstanding, overdue, approved, and paid semantics
  remain explicit and are not merged for display convenience.
- Report view and export permissions remain separate; frontend affordances do
  not replace server/RLS/company-scope enforcement.
- Documents and exports reuse the existing guarded document platform; no
  product introduces a parallel document engine or a client-side financial
  calculation path.
