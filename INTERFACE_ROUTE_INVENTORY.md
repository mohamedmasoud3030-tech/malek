# INTERFACE_ROUTE_INVENTORY

> **Product:** MALEK — Arabic-first multi-company property office operations  
> **Evidence base:** `route-contract.ts`, `app-nav-items.ts`, `route-tree.ts`, AppShell, live dev shell HTTP 200  
> **Date:** 2026-08-18  
> **Note:** Mapping only; no product-behavior changes required by this document alone.

## Global chrome

| Surface | Roles | Purpose | Pattern | Mobile | Desktop | Problems |
|---|---|---|---|---|---|---|
| AppShell sidebar | authenticated | Task navigation | Fixed RTL sidebar 7 roots + expandable children | Hidden; drawer + floating Menu/Search | Expanded/collapsed rail | None critical; floating control intentionally Menu+Search only (`mobileNavItems=[]`) |
| AppShell header | authenticated | Brand, search (md+), quick-add, notifications, theme, user | Sticky header | Hamburger lg:hidden | Sidebar toggle | Dual brand (header + sidebar) intentional for collapsed rail |
| Command palette | authenticated | Cross-entity jump | Dialog | Via floating Search | Header trigger | — |
| Permission request dialog | any locked nav | Request capability | Dialog | same | same | — |

## Public / auth

| Route | Roles | Purpose | Primary task | Pattern | States | Data |
|---|---|---|---|---|---|---|
| `/`, `/landing` | anon | Marketing | Understand product → login | Landing sections | static | none |
| `/login` | anon | Sign in | Authenticate | Auth form | env error, field error, caps lock | Auth |
| `/forgot-password`, `/reset-password` | anon | Recovery | Reset password | Auth form | neutral success, expired link | Auth |
| `/privacy`, `/terms` | anon | Legal | Read policy | Legal page | static | none |

## Today

| Route | Roles | Purpose | Primary question | Pattern | Mobile/Desktop | Problems |
|---|---|---|---|---|---|---|
| `/dashboard` | all auth | Work queue | What needs action now? | Overview: hero, onboarding, work-now, KPI, queues | Single responsive stack | Must not fake zero KPIs on error (already guarded) |

## Portfolio (sidebar root `/properties`)

| Route | Roles | Purpose | Pattern | Notes |
|---|---|---|---|---|
| `/properties` | auth | Property register | ListPage + DataTable(=EntityTable) cards on mobile | Children: units/lands/owners via `?section=` |
| `/properties/new` | properties.write | Create property | Form (modal/page) | |
| `/properties/$id` | auth | Property dossier | Detail tabs/sections | Single body for all breakpoints |
| `/properties/$id/edit` | properties.write | Edit property | Form | |
| `/properties/$id/units`, `.../units/$unitId` | auth | Unit under property | Detail | |
| `/units` | auth | Redirect → properties?section=units | redirect | Keep for bookmarks |
| `/lands`, `/lands/$id` | lands.view | Land register/dossier | EntityTable + detail | |
| `/owners` | owners.hub.view | Owner register | DataTable + preview dialog | **Column priorities fixed this session** |
| `/owners/$id`, `.../edit` | owners.* | Owner dossier/edit | Detail / form | |

## Leasing (sidebar root `/contracts`)

| Route | Roles | Purpose | Pattern |
|---|---|---|---|
| `/contracts` | auth | Contract register | EntityTable |
| `/contracts/new`, `/$id`, `/$id/edit` | write as needed | Create/detail/edit | Form / dossier / form |
| `/tenants`, `/tenants/$id` | auth | Tenant register/dossier | List + detail (workspace children) |
| `/people`, `/people/new`, `/$id`, `/$id/edit` | auth | Party directory | ListPage + detail |
| `/leads` | leads.view | Pipeline | EntityTable |
| `/communication` | communication.view | Comms log | EntityTable |

## Money (sidebar root `/financials`)

| Route | Roles | Purpose | Pattern |
|---|---|---|---|
| `/financials` + section/view search | mixed per view | Money hub | SectionTabs + embedded workspaces |
| collections: invoices/receipts/arrears | auth / arrears.view | AR ops | EntityTable + detail panels |
| expenses (+ commissions panel) | expenses.view / commissions.view | Expense ops | DataTable/EntityTable |
| funds: deposits, owner settlements | financial.* | Liability & payout | EntityTable workspaces |
| banking: bank reconciliation | financial.bank_reconciliation.view | Match bank lines | EntityTable + forms; **error≠empty fixed prior** |
| standalone `/invoices` etc. | same | Deep links | Redirect/bind into hub |
| `/commissions` | commissions.view | May compose inside Money | Keep deep link |

## Services (sidebar root `/maintenance`)

| Route | Roles | Purpose | Pattern |
|---|---|---|---|
| `/maintenance` | auth | Maintenance queue | List/DataTable + detail overlays |
| `/service-providers` (+new/detail/edit) | service_providers.* | Vendor register | ListPage + EntityTable |
| utilities via `?section=utilities` | auth | Meters/bills | EntityTable |
| documents vault section | auth | Vault | List + upload |

## Reports / Settings / AI

| Route | Roles | Purpose | Pattern |
|---|---|---|---|
| `/reports`, `/accounting` | financial.reports.view (reports) | Statements & analysis | Report workspace panels + tables/charts where justified |
| `/settings` + sections | various manage perms | Company, users, cost centers, automation, system | Settings sections |
| `/audit-log`, `/data-integrity`, `/system` | audit/integrity/system | Admin ops | Tables |
| `/ai-assistant` | auth | Read-only assistant | Conversation + capability panel |
| `/change-password` | auth | Security | Form |
| `/automation` | automation.view | Redirect into settings | redirect |

## Confirmed interface problems (actionable)

1. **Owner register** lacked explicit column priorities → mobile datum less intentional — **fixed this session**.  
2. **Bank lines** mobile datum was status; money work needs amount first — **fixed this session**.  
3. **Dead import** `EntityCard` on bank page — **removed**.  
4. **Legacy `ContractMobileCard.tsx`** exists but production registers must not use page-local mobile cards (contracts already on EntityTable). File is residual; schedule remove after zero consumers (tests only).  
5. **Dual table import names** (`DataTable` alias of `EntityTable`) — keep alias; do not fork.  
6. Mobile bottom destinations intentionally empty — **KEEP** (Menu + Search); do not add 5-tab bar without IA decision overturning WP-06.

## Permission boundary summary

- Navigation visibility: `canShowNavigationItem` / locks with request dialog.  
- Writes: role + effective grants; OPERATIONS fenced from four financial writes in UI.  
- Company: fail-closed shell without active company claim.
