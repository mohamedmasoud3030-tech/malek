# Product

> **Brand note:** MALIK هو الاسم التجاري الحالي للمنتج المعروف تقنيًا داخل بعض المسارات القديمة باسم Rentrix.
> MALIK is the product's current commercial name. Some technical paths and identifiers — the `rentrix-app/` package directory, the `@workspace/rentrix` package name, persisted storage keys, and the current Vercel host — intentionally still read `rentrix`. They are invisible to users and are frozen in this release.

## What MALIK is

MALIK is a web application for managing rental property operations for a single real-estate office: properties, units, owners, tenants, contracts, invoicing, payments/receipts, expenses, maintenance, and reporting. The UI is Arabic-first (route titles and navigation labels are in Arabic; see `rentrix-app/src/app/navigation/app-nav-items.ts`).

## Intended users

Office staff who operate day-to-day property management tasks: recording contracts, tracking invoices and collections, handling maintenance requests, and reviewing owner/tenant/financial reports. The permission model (`rentrix-app/src/features/auth/permissions.ts`) distinguishes `ADMIN`, `MANAGER`, and `USER` roles, with specific view permissions gating sections such as owners, maintenance, leads, commissions, and system administration.

## Areas of the product (as reflected in navigation and routes)

- **Portfolio**: Properties, Units, Lands
- **Relationships & customers**: Owners (with owner agreements), Tenants, People directory, Leads, Communication log
- **Contracts & operations**: Contracts, Maintenance, Utilities, Automation, Documents vault
- **Financials**: Financial overview, Invoices, Receipts, Expenses, Arrears, Deposits, Owner settlements, Bank reconciliation, Commissions
- **Reports & decisions**: Reports (collections, occupancy, overdue, statements, overview), read-only AI assistant
- **Administration & governance**: Company settings, Change password, Audit log, Data integrity checks, System governance

The phone bottom bar intentionally exposes five stable daily hubs only: Dashboard, Properties, Contracts, Financial overview, and Reports. Every authorized workspace remains available in the full mobile drawer. This avoids seven competing bottom-bar destinations and gives invoices, receipts, expenses, deposits, and settlements one predictable financial entry point.

Each area above corresponds to a route under `rentrix-app/src/routes/` and a feature folder under `rentrix-app/src/features/`. Treat this list as a map to the code, not a claim about completeness of any one area — check `docs/CURRENT_STATE.md` and the relevant feature folder before relying on specific behavior.

## What the product is for

The application exists to give a property management office one system of record for contracts and money movement, instead of spreadsheets or disconnected tools — so that invoices, payments, expenses, and owner payouts stay consistent and auditable.

## Product decision: receipts and collections

Until a product decision changes it, collection reporting is based on posted payments. Voided receipts/payments are retained as history but are not revenue/collection. Owner settlements and tenant deposits now have dedicated, auditable lifecycles; multi-currency and deferred-revenue accounting remain separate product decisions and must not be inferred from receipt reporting work.
