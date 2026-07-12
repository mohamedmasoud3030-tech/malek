# Product

## What Rentrix is

Rentrix is an Arabic-first rental-property management system for a single real-estate office. It connects portfolio operations, people, contracts, money movement, maintenance, reporting, and governance in one Supabase-backed application.

The product is intended to replace disconnected spreadsheets and manual records with an auditable operational and financial system.

## Intended users

- **ADMIN** — full administration and sensitive operational/financial control.
- **MANAGER** — management workflows and authorized financial operations.
- **USER** — limited operational access according to named permissions.

Frontend visibility is permission-gated, but the database authorization boundary remains RLS, grants, constraints, and guarded RPCs.

## Product areas

| Area | Current scope |
| --- | --- |
| Portfolio | Properties, units, lands, occupancy and location data |
| People | People directory, tenants, owners and owner agreements |
| Contracts | Create, update, renew, terminate, soft delete and documents |
| Billing | Invoices, payment cycles, arrears and balances |
| Collections | Payments, payment-backed receipts, void history |
| Expenses | Property/unit expenses, cost centers and atomic journal updates |
| Accounting | Chart of accounts, journal entries, VAT and balanced invoice/payment flows |
| Maintenance | Requests, resolution and expense creation |
| Reports | Collections, cash flow, VAT, overdue, occupancy, owner/tenant statements and financial summaries |
| Banking | Bank accounts, statement lines, matching and reconciliation foundation |
| Sales/operations | Leads, commissions, communications |
| Administration | Company settings, payment terms, audit log, integrity checks and governance |
| Assistance | AI assistant surface, subject to configured provider and release evidence |

This table describes the intended operational surface. It is not a release claim; check `docs/CURRENT_STATE.md` and `docs/RELEASE_READINESS.md`.

## Product invariants

- `public.people` is the canonical tenant identity source.
- Contracts and their destructive lifecycle operations use atomic backend paths.
- Invoice generation creates balanced accounting entries.
- Payments and receipts are linked through the payment-backed collection model.
- VOID/CANCELLED history is retained but excluded from applicable totals.
- Posted journal entries are immutable and corrected through reversals.
- Company-facing reports must agree with the underlying invoice/payment/expense lifecycle.
- Sensitive financial operations require backend authorization, not only hidden buttons.

## Current product boundary

The core product includes real Supabase-backed modules, but full release sign-off still depends on exact-candidate staging/browser/backend evidence.

The following remain planned or incomplete product/accounting depth:

- full office management-fee and owner payout lifecycle,
- master-lease fixed owner obligations,
- daily/weekly/open-ended contract billing,
- full utility responsibility and posting,
- tenant security-deposit ledger,
- deferred-revenue reporting,
- multi-currency,
- advanced bank-file ingestion and reconciliation rules.

Approved accounting policies are recorded under `docs/decisions/`; implementation should follow those decisions instead of inventing new rules.

## Release objective

Rentrix is ready for release only when one immutable release-candidate SHA passes the code, migration, backend, role, financial reconciliation, browser, RTL/responsive, document/export, and formatting gates in `docs/RELEASE_READINESS.md`.
