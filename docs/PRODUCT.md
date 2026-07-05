# Product

## What Rentrix is

Rentrix is a web application for managing rental property operations for a single real-estate office: properties, units, owners, tenants, contracts, invoicing, payments/receipts, expenses, maintenance, and reporting. The UI is Arabic-first (route titles and navigation labels are in Arabic; see `rentrix-app/src/components/layout/app-nav-items.ts`).

## Intended users

Office staff who operate day-to-day property management tasks: recording contracts, tracking invoices and collections, handling maintenance requests, and reviewing owner/tenant/financial reports. The permission model (`rentrix-app/src/features/auth/permissions.ts`) distinguishes `ADMIN`, `MANAGER`, and `USER` roles, with specific view permissions gating sections such as owners, maintenance, leads, commissions, and system administration.

## Areas of the product (as reflected in navigation and routes)

- **Portfolio**: Properties, Units, Lands
- **People & relationships**: People directory, Owners (with owner agreements), Tenants
- **Operations**: Contracts, Maintenance, Communication log
- **Financials & collections**: Invoices, Receipts, Expenses, Arrears
- **Reporting**: Reports (collections, occupancy, overdue, statements, overview)
- **Sales**: Leads, Commissions
- **Settings**: Company settings, cost centers, payment terms, role simulation
- **System**: Audit log, data integrity checks, system governance

Each area above corresponds to a route under `rentrix-app/src/routes/` and a feature folder under `rentrix-app/src/features/`. Treat this list as a map to the code, not a claim about completeness of any one area — check `docs/CURRENT_STATE.md` and the relevant feature folder before relying on specific behavior.

## What the product is for

The application exists to give a property management office one system of record for contracts and money movement, instead of spreadsheets or disconnected tools — so that invoices, payments, expenses, and owner payouts stay consistent and auditable.
